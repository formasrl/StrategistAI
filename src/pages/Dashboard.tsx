import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut, UserCircle2 } from 'lucide-react';
import AiPanel from '@/components/ai/AiPanel';
import { AiReview, Project, Phase, Step, Document } from '@/types/supabase'; // Import types
import CurrentContextDisplay from '@/components/layout/CurrentContextDisplay'; // New import

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  // Use useParams to get current route parameters
  const { projectId, documentId, stepId } = useParams<{ projectId?: string; documentId?: string; stepId?: string }>();

  // State to manage the documentId and stepId that the AiPanel should focus on
  const [aiPanelDocumentId, setAiPanelDocumentId] = useState<string | undefined>(documentId);
  const [aiPanelStepId, setAiPanelStepId] = useState<string | undefined>(stepId);
  const [aiPanelPhaseId, setAiPanelPhaseId] = useState<string | undefined>(undefined); // Derived from stepId

  const [activeAiReview, setActiveAiReview] = useState<AiReview | null>(null);
  const [isAiReviewLoading, setIsAiReviewLoading] = useState(false);

  // States for current context display
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  // Update aiPanelDocumentId and aiPanelStepId when URL params change
  useEffect(() => {
    setAiPanelDocumentId(documentId);
    setAiPanelStepId(stepId);
  }, [documentId, stepId]);

  // Effect to fetch active context (project, phase, step, document)
  useEffect(() => {
    const fetchActiveContext = async () => {
      setActiveProject(null);
      setActivePhase(null);
      setActiveStep(null);
      setActiveDocument(null);

      if (documentId) {
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('*, steps(*, phases(*)), projects(*)')
          .eq('id', documentId)
          .single();

        if (docError) {
          console.error('Error fetching active document context:', docError);
        } else if (docData) {
          setActiveDocument(docData);
          if (docData.steps) {
            setActiveStep(docData.steps);
            if (docData.steps.phases) {
              setActivePhase(docData.steps.phases);
            }
          }
          if (docData.projects) {
            setActiveProject(docData.projects);
          }
        }
      } else if (stepId) {
        const { data: stepData, error: stepError } = await supabase
          .from('steps')
          .select('*, phases(*), projects(*)')
          .eq('id', stepId)
          .single();

        if (stepError) {
          console.error('Error fetching active step context:', stepError);
        } else if (stepData) {
          setActiveStep(stepData);
          if (stepData.phases) {
            setActivePhase(stepData.phases);
          }
          if (stepData.projects) {
            setActiveProject(stepData.projects);
          }
        }
      } else if (projectId) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Error fetching active project context:', projectError);
        } else if (projectData) {
          setActiveProject(projectData);
        }
      }
    };

    fetchActiveContext();
  }, [projectId, stepId, documentId]);


  // Fetch phaseId if aiPanelStepId is set
  useEffect(() => {
    if (aiPanelStepId) {
      const fetchPhaseId = async () => {
        const { data, error } = await supabase
          .from('steps')
          .select('phase_id')
          .eq('id', aiPanelStepId)
          .single();
        if (error) {
          console.error('Error fetching phaseId for AI panel:', error);
          setAiPanelPhaseId(undefined);
        } else {
          setAiPanelPhaseId(data.phase_id);
        }
      };
      fetchPhaseId();
    } else {
      setAiPanelPhaseId(undefined);
    }
  }, [aiPanelStepId]);

  // Function to fetch the latest AI review for a given document
  const fetchLatestAiReview = useCallback(async (docId: string) => {
    setIsAiReviewLoading(true);
    const { data: reviewData, error: reviewError } = await supabase
      .from('ai_reviews')
      .select('*')
      .eq('document_id', docId)
      .order('review_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewError && reviewError.code !== 'PGRST116') {
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
      await fetchLatestAiReview(docId);
    }
    setIsAiReviewLoading(false);
  }, [isAiReviewLoading, fetchLatestAiReview, session?.access_token]);

  // Reset AI review state and fetch new review when aiPanelDocumentId changes
  useEffect(() => {
    if (aiPanelDocumentId) {
      fetchLatestAiReview(aiPanelDocumentId);
    } else {
      setActiveAiReview(null);
      setIsAiReviewLoading(false);
    }
  }, [aiPanelDocumentId, fetchLatestAiReview]);

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
  const outletContextValue = {
    setAiReview: setActiveAiReview,
    setIsAiReviewLoading: setIsAiReviewLoading,
    setDocumentIdForAiPanel: setAiPanelDocumentId, // Pass setter for document ID
    setStepIdForAiPanel: setAiPanelStepId,       // Pass setter for step ID
  };

  return (
    <DashboardLayout
      sidebar={
        <div className="space-y-4 flex flex-col h-full">
          <h2 className="text-xl font-semibold text-sidebar-foreground">Your Projects</h2>
          <Button onClick={() => navigate('/project/new')} className="w-full" variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Project
          </Button>
          <CurrentContextDisplay
            activeProject={activeProject}
            activePhase={activePhase}
            activeStep={activeStep}
            activeDocument={activeDocument}
          />
          <div className="flex-1 overflow-y-auto">
            <ProjectList />
          </div>
          <div className="pt-4 border-t border-sidebar-border space-y-2">
            <Button onClick={() => navigate('/dashboard/profile')} className="w-full" variant="ghost">
              <UserCircle2 className="mr-2 h-4 w-4" /> Profile
            </Button>
            <Button onClick={() => navigate('/dashboard/settings')} className="w-full" variant="ghost">
              <Settings className="mr-2 h-4 w-4" /> Settings
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
            phaseId={aiPanelPhaseId} // Pass derived phaseId
            stepId={aiPanelStepId}
            documentId={aiPanelDocumentId}
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