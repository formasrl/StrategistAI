import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut, UserCircle2 } from 'lucide-react';
import AiPanel from '@/components/ai/AiPanel';
import { AiReview, Project, Phase, Step, Document } from '@/types/supabase';
import CurrentContextDisplay from '@/components/layout/CurrentContextDisplay';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useAppSetup } from '@/components/layout/AppSetupProvider';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const Dashboard = () => {
  const { session, isLoading: isSessionLoading } = useSession();
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

  useEffect(() => {
    if (!isSessionLoading && !session) {
      navigate('/login');
    }
  }, [session, isSessionLoading, navigate]);

  useEffect(() => {
    setAiPanelDocumentId(documentId);
    setAiPanelStepId(stepId);
  }, [documentId, stepId]);

  // Fetching Active Context
  const { data: activeContextData } = useSupabaseQuery(
    ['activeContext', { projectId, documentId, stepId }],
    () => {
      if (documentId) {
        return supabase
          .from('documents')
          .select('*, steps(*, phases(*)), projects(*)')
          .eq('id', documentId)
          .single();
      }
      if (stepId) {
        return supabase
          .from('steps')
          .select('*, phases(*), projects(*)')
          .eq('id', stepId)
          .single();
      }
      if (projectId) {
        return supabase.from('projects').select('*').eq('id', projectId).single();
      }
      return Promise.resolve({ data: null, error: null });
    }
  );

  const { activeProject, activePhase, activeStep, activeDocument } = useMemo(() => {
    if (!activeContextData) {
      return { activeProject: null, activePhase: null, activeStep: null, activeDocument: null };
    }
    if (documentId) {
      const doc = activeContextData as any;
      const step = doc.steps;
      const phase = step?.phases;
      const project = doc.projects;
      return { activeProject: project, activePhase: phase, activeStep: step, activeDocument: doc };
    }
    if (stepId) {
      const step = activeContextData as any;
      const phase = step.phases;
      const project = step.projects;
      return { activeProject: project, activePhase: phase, activeStep: step, activeDocument: null };
    }
    if (projectId) {
      return { activeProject: activeContextData as Project, activePhase: null, activeStep: null, activeDocument: null };
    }
    return { activeProject: null, activePhase: null, activeStep: null, activeDocument: null };
  }, [activeContextData, projectId, documentId, stepId]);

  // Fetching Phase ID for AI Panel
  const { data: phaseData } = useSupabaseQuery(
    ['aiPanelPhase', aiPanelStepId],
    () => {
      if (!aiPanelStepId) return Promise.resolve({ data: null, error: null });
      return supabase.from('steps').select('phase_id').eq('id', aiPanelStepId).single();
    }
  );
  const aiPanelPhaseId = phaseData?.phase_id;

  // AI Review Logic
  const queryClient = useQueryClient();

  const { data: activeAiReview, isLoading: isAiReviewLoading } = useSupabaseQuery(
    ['aiReview', aiPanelDocumentId],
    () => {
      if (!aiPanelDocumentId) return Promise.resolve({ data: null, error: null });
      return supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', aiPanelDocumentId)
        .order('review_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
    }
  );

  const { mutate: generateAiReview, isPending: isGeneratingAiReview } = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.functions.invoke('generate-ai-review', {
        body: { documentId: docId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, docId) => {
      showSuccess('AI review generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['aiReview', docId] });
    },
    onError: (error) => {
      showError(`AI review failed: ${error.message}`);
    },
  });

  if (isSessionLoading) {
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
    setDocumentIdForAiPanel: setAiPanelDocumentId,
    setStepIdForAiPanel: setAiPanelStepId,
    aiReview: activeAiReview,
    isAiReviewLoading: isAiReviewLoading || isGeneratingAiReview,
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
            isAiReviewLoading={isAiReviewLoading || isGeneratingAiReview}
            onGenerateReview={generateAiReview}
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