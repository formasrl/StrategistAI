import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut, UserCircle2 } from 'lucide-react';
import AiPanel from '@/components/ai/AiPanel'; // New import for AiPanel
import { AiReview } from '@/types/supabase';

// Define the type for the Outlet context
interface DashboardOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
}

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const { projectId, documentId } = useParams<{ projectId?: string; documentId?: string }>();
  const phaseId = parseInt(useParams<{ phaseId?: string }>().phaseId || '0'); // Assuming phaseId can be extracted if needed
  const stepId = parseInt(useParams<{ stepId?: string }>().stepId || '0'); // Assuming stepId can be extracted if needed

  const [activeAiReview, setActiveAiReview] = useState<AiReview | null>(null);
  const [isAiReviewLoading, setIsAiReviewLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  // Function to fetch the latest AI review for a given document
  const fetchLatestAiReview = useCallback(async (docId: string) => {
    setIsAiReviewLoading(true);
    const { data: reviewData, error: reviewError } = await supabase
      .from('ai_reviews')
      .select('*')
      .eq('document_id', docId)
      .order('review_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle to handle no rows gracefully

    if (reviewError && reviewError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching AI review:', reviewError);
      setActiveAiReview(null);
      showError(`Failed to load AI review: ${reviewError.message}`);
    } else if (reviewData) {
      setActiveAiReview(reviewData);
    } else {
      setActiveAiReview(null);
    }
    setIsAiReviewLoading(false);
  }, []);

  // Handle AI review generation from the AI panel
  const handleGenerateAiReviewFromPanel = useCallback(async (docId: string) => {
    if (!docId || isAiReviewLoading) return;

    setIsAiReviewLoading(true);
    const { data, error } = await supabase.functions.invoke('generate-ai-review', {
      body: { documentId: docId },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (error) {
      showError(`AI review failed: ${error.message}`);
      setActiveAiReview(null);
    } else {
      showSuccess('AI review generated successfully!');
      // Refetch the latest review from the database to ensure consistency
      await fetchLatestAiReview(docId);
    }
    setIsAiReviewLoading(false);
  }, [isAiReviewLoading, fetchLatestAiReview, session?.access_token]);


  // Reset AI review state and fetch new review when documentId changes
  useEffect(() => {
    if (documentId) {
      fetchLatestAiReview(documentId);
    } else {
      setActiveAiReview(null);
      setIsAiReviewLoading(false);
    }
  }, [documentId, fetchLatestAiReview]);


  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(`Logout failed: ${error.message}`);
    } else {
      showSuccess('You have been logged out.');
      navigate('/login');
    }
  };

  // The context value to be passed to nested routes
  const outletContextValue: DashboardOutletContext = {
    setAiReview: setActiveAiReview,
    setIsAiReviewLoading: setIsAiReviewLoading,
  };

  return (
    <DashboardLayout
      sidebar={
        <div className="space-y-4 flex flex-col h-full">
          <h2 className="text-xl font-semibold text-sidebar-foreground">Your Projects</h2>
          <Button onClick={() => navigate('/project/new')} className="w-full" variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Project
          </Button>
          <div className="flex-1 overflow-y-auto">
            <ProjectList />
          </div>
          <div className="pt-4 border-t border-sidebar-border space-y-2">
            <Button onClick={() => navigate('/dashboard/profile')} className="w-full" variant="ghost">
              <UserCircle2 className="mr-2 h-4 w-4" /> Profile
            </Button>
            <Button onClick={() => navigate('/dashboard/settings')} className="w-full" variant="ghost">
              <Settings className="mr-2 h-4 w-4" /> AI Settings
            </Button>
            <Button onClick={handleLogout} variant="destructive" className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      }
      mainContent={
        <div className="h-full">
          <Outlet context={outletContextValue} /> {/* Pass context to nested routes */}
        </div>
      }
      aiPanel={
        <div className="space-y-4 h-full flex flex-col">
          <AiPanel
            projectId={projectId}
            phaseId={phaseId}
            stepId={stepId}
            documentId={documentId}
            aiReview={activeAiReview}
            isAiReviewLoading={isAiReviewLoading}
            onGenerateReview={handleGenerateAiReviewFromPanel}
          />
        </div>
      }
    />
  );
};

export default Dashboard;