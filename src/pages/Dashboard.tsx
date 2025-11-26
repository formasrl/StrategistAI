import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut, UserCircle2 } from 'lucide-react';
import AiPanel from '@/components/ai/AiPanel';
import { Project, Phase, Step, Document } from '@/types/supabase';
import CurrentContextDisplay from '@/components/layout/CurrentContextDisplay';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useAppSetup } from '@/components/layout/AppSetupProvider';
import { getLastActiveStep, clearLastActiveStep } from '@/utils/localStorage';

// Define context type to include refreshProjects
type DashboardOutletContext = {
  setDocumentIdForAiPanel?: (docId: string | undefined) => void;
  setStepIdForAiPanel?: (stepId: string | undefined) => void;
  refreshProjects?: () => void;
  setContentToInsert?: (content: string | null) => void;
  contentToInsert?: string | null;
  handleAttemptInsertContent?: (content: string) => void; // New context prop
};

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, documentId, stepId } = useParams<{
    projectId?: string;
    documentId?: string;
    stepId?: string;
  }>();

  const { onboardingTourCompleted, markOnboardingTourComplete } = useAppSetup();

  const [aiPanelDocumentId, setAiPanelDocumentId] = useState<string | undefined>(documentId);
  const [aiPanelStepId, setAiPanelStepId] = useState<string | undefined>(stepId);
  const [aiPanelPhaseId, setAiPanelPhaseId] = useState<string | undefined>(undefined);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);

  const [projectsRefreshTrigger, setProjectsRefreshTrigger] = useState(0);
  const [contentToInsert, setContentToInsert] = useState<string | null>(null);
  const [handleAttemptInsertContent, setHandleAttemptInsertContent] = useState<((content: string) => void) | undefined>(undefined);


  const refreshProjects = useCallback(() => {
    setProjectsRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    } else if (!isLoading && session) {
      if (!projectId && !stepId && !documentId) {
        const lastActive = getLastActiveStep();
        if (lastActive) {
          if (lastActive.documentId) {
            navigate(`/dashboard/${lastActive.projectId}/document/${lastActive.documentId}`);
          } else if (lastActive.stepId) {
            navigate(`/dashboard/${lastActive.projectId}/step/${lastActive.stepId}`);
          } else if (lastActive.projectId) {
            navigate(`/dashboard/${lastActive.projectId}`);
          }
          return;
        }
      }

      const checkProjects = async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (error || !data || data.length === 0) {
          if (!projectId && !stepId && !documentId) {
            navigate('/project/new');
          }
        }
      };

      if (!projectId && !stepId && !documentId) {
        checkProjects();
      }
    }
  }, [session, isLoading, navigate, projectId, stepId, documentId]);


  useEffect(() => {
    setAiPanelDocumentId(documentId);
    setAiPanelStepId(stepId);
  }, [documentId, stepId]);

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
          .select('*, phases(*, projects(*))')
          .eq('id', stepId)
          .single();

        if (stepError) {
          console.error('Error fetching active step context:', stepError);
        } else if (stepData) {
          setActiveStep(stepData);
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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showError(`Logout failed: ${error.message}`);
    } else {
      showSuccess('You have been logged out.');
      clearLastActiveStep();
      navigate('/login');
    }
  };

  const outletContextValue: DashboardOutletContext = {
    setDocumentIdForAiPanel: setAiPanelDocumentId,
    setStepIdForAiPanel: setAiPanelStepId,
    refreshProjects,
    setContentToInsert,
    contentToInsert,
    handleAttemptInsertContent: (content: string) => {
      // This function will be called by AiChatbot
      // It needs to be passed down to DocumentEditor to execute the logic
      // For now, we'll just set it here, and DocumentEditor will pick it up
      // and execute its own handleAttemptInsertContent.
      // This is a temporary bridge. The actual logic is in DocumentEditor.
      setHandleAttemptInsertContent(() => (c: string) => {
        // This inner function will be called by DocumentEditor's useEffect
        // to trigger its own handleAttemptInsertContent.
        // This is a workaround for passing functions through Outlet context.
        // A more robust solution might involve a global state manager or direct prop drilling
        // if the component hierarchy was simpler.
        console.log("Dashboard received content to insert:", c);
        setContentToInsert(c);
      });
    },
  };

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
              <ProjectList refreshTrigger={projectsRefreshTrigger} />
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
            contentToInsert={contentToInsert}
            setContentToInsert={setContentToInsert}
            handleAttemptInsertContent={handleAttemptInsertContent} // Pass the new prop
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