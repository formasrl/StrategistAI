import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, OutletContext } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut } from 'lucide-react';
import AiReviewDisplay from '@/components/ai/AiReviewDisplay';
import { AiReview } from '@/types/supabase';

// Define the type for the Outlet context
interface DashboardOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
}

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const [activeAiReview, setActiveAiReview] = useState<AiReview | null>(null);
  const [isAiReviewLoading, setIsAiReviewLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

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
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sidebar-foreground">AI Assistant</h2>
          <AiReviewDisplay review={activeAiReview} isLoading={isAiReviewLoading} />
        </div>
      }
    />
  );
};

export default Dashboard;