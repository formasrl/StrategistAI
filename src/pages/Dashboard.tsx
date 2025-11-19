import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, useParams, useLocation } from 'react-router-dom'; // Import useLocation
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut, UserCircle2 } from 'lucide-react';
import AiPanel from '@/components/ai/AiPanel';
import { AiReview, Project, Phase, Step, Document } from '@/types/supabase';
import CurrentContextDisplay from '@/components/layout/CurrentContextDisplay';
import OnboardingTour from '@/components/onboarding/OnboardingTour'; // Import OnboardingTour
import { useAppSetup } from '@/components/layout/AppSetupProvider'; // Import useAppSetup

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation(); // Get current location
  const { projectId, documentId, stepId } = useParams<{
    projectId?: string;
    documentId?: string;
    stepId?: string;
  }>();

  const { onboardingTourCompleted, markOnboardingTourComplete } = useAppSetup(); // Use the new context

  const [aiPanelDocumentId, setAiPanelDocumentId] = useState<string | undefined>(documentId);
  const [aiPanelStepId, setAiPanelStepId] = useState<string | undefined>(stepId);
  const [aiPanelPhaseId, setAiPanelPhaseId] = useState<string | undefined>(undefined);

  const [activeAiReview, setActiveAiReview] = useState<AiReview | null>(null);
  const [isAiReviewLoading, setIsAiReviewLoading] = useState(false);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  useEffect(() => {
    setAiPanelDocumentId(documentId);
    setAiPanelStepId(stepId);
  }, [documentId, stepId]);

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
        // Fixed query: select projects VIA phases because steps doesn't have project_id
        const { data: stepData, error: stepError } = await supabase
          .from('steps')
          .select('*, phases(*, projects(*))')
          .eq('id', stepId)
          .single();

        if (stepError) {
          console.error('Error fetching active step context:', stepError);
        } else if (stepData) {
          setActiveStep(stepData);
          
          // Handle the nested relationship data
          const phase = stepData.phases as any;
          if (phase) {
            setActivePhase(phase as Phase);
            if (phase.projects) {
              setActiveProject(phase.projects as Project);
            }
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

  const handleGenerateAiReviewFromPanel = useCallback(
    async (docId: string) => {
      if (!docId || isAiReviewLoading) return;

      setIsAiReviewLoading(true);
      const { error } = await supabase.functions.invoke('generate-ai-review', {
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
    },
    [isAiReviewLoading, fetchLatestAiReview, session?.access_token]
  );

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

  const outletContextValue = {
    setAiReview: setActiveAiReview,
    setIsAiReviewLoading: setIsAiReviewLoading,
    setDocumentIdForAiPanel: setAiPanelDocumentId,
    setStepIdForAiPanel: setAiPanelStepId,
    aiReview: activeAiReview,
    isAiReviewLoading,
  };

  // Determine if the tour should run
  const shouldRunTour = !onboardingTourCompleted && location.pathname.startsWith('/dashboard');

  return (
    <>
      <DashboardLayout
        sidebar={
          <>
            <div className="space-y-4 pb-4 shrink-0">
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
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <ProjectList />
            </div>
            <div className="pt-4 border-t border-sidebar-border space-y-2 shrink-0">
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
          </>
        }
        mainContent={<Outlet context={outletContextValue} />}
        aiPanel={
          <AiPanel
            projectId={projectId}
            phaseId={aiPanelPhaseId}
            stepId={aiPanelStepId}
            documentId={aiPanelDocumentId}
            aiReview={activeAiReview}
            isAiReviewLoading={isAiReviewLoading}
            onGenerateReview={handleGenerateAiReviewFromPanel}
          />
        }
      />
      {shouldRunTour && (
        <OnboardingTour
          runTour={shouldRunTour}
          onTourComplete={markOnboardingTourComplete}
        />
      )}
    </>
  );
};

export default Dashboard;