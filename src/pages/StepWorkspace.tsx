import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Step, AiReview } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import DocumentEditor from './DocumentEditor';
import { saveLastActiveStep } from '@/utils/localStorage';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { stepGuidanceLibrary } from '@/utils/stepGuidanceData';

interface StepWorkspaceOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
  setDocumentIdForAiPanel: (docId: string | undefined) => void;
  setStepIdForAiPanel: (stepId: string | undefined) => void;
  handleAttemptInsertContent: (content: string) => void; // New context prop
}

const StepWorkspace: React.FC = () => {
  // Handle both route patterns: /step/:stepId and /document/:documentId
  const { projectId, stepId: paramStepId, documentId: paramDocumentId } = useParams<{ projectId: string; stepId?: string; documentId?: string }>();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<Step | null>(null);
  const [isLoadingStep, setIsLoadingStep] = useState(true);
  
  // Resolved IDs
  const [resolvedStepId, setResolvedStepId] = useState<string | undefined>(paramStepId);
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>(paramDocumentId);
  
  const [isLoadingResolution, setIsLoadingResolution] = useState(true);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(true);

  // New states for phase steps navigation
  const [phaseSteps, setPhaseSteps] = useState<Step[]>([]);
  const [isLoadingPhaseSteps, setIsLoadingPhaseSteps] = useState(false);

  const {
    setAiReview,
    setIsAiReviewLoading,
    setDocumentIdForAiPanel,
    setStepIdForAiPanel,
    handleAttemptInsertContent, // Destructure new context prop
  } = useOutletContext<StepWorkspaceOutletContext>();

  // 1. Resolution Effect
  useEffect(() => {
    const resolveContext = async () => {
      setIsLoadingResolution(true);

      if (paramDocumentId && !paramStepId) {
        setActiveDocumentId(paramDocumentId);
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .select('step_id')
          .eq('id', paramDocumentId)
          .single();

        if (docError) {
          showError(`Failed to resolve document context: ${docError.message}`);
          setResolvedStepId(undefined);
        } else if (docData.step_id) {
          setResolvedStepId(docData.step_id);
        }
      } 
      else if (paramStepId) {
        setResolvedStepId(paramStepId);
        if (!paramDocumentId) {
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('id')
            .eq('step_id', paramStepId)
            .limit(1);
            
          if (docsError) {
            console.error("Error fetching step documents:", docsError);
          } else if (docs && docs.length > 0) {
            setActiveDocumentId(docs[0].id);
          } else {
            setActiveDocumentId(undefined);
          }
        } else {
          setActiveDocumentId(paramDocumentId);
        }
      }
      
      setIsLoadingResolution(false);
    };

    resolveContext();
  }, [paramStepId, paramDocumentId]);

  // 2. Fetch Step Data Effect
  useEffect(() => {
    const fetchStepDetails = async () => {
      if (!resolvedStepId) {
        if (!isLoadingResolution) setIsLoadingStep(false);
        return;
      }

      setIsLoadingStep(true);
      const { data, error } = await supabase
        .from('steps')
        .select('*, phases(id, phase_name, phase_number)') // Select phase details too
        .eq('id', resolvedStepId)
        .single();

      if (error) {
        showError(`Failed to load step details: ${error.message}`);
        setStep(null);
      } else {
        setStep(data);
      }
      setIsLoadingStep(false);
    };

    fetchStepDetails();
  }, [resolvedStepId, isLoadingResolution]);

  // NEW EFFECT: Fetch all steps for the current phase
  useEffect(() => {
    const fetchPhaseSteps = async () => {
      if (!step?.phase_id) {
        setPhaseSteps([]);
        return;
      }

      setIsLoadingPhaseSteps(true);
      const { data, error } = await supabase
        .from('steps')
        .select('id, step_name, order_index')
        .eq('phase_id', step.phase_id)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching phase steps:', error);
        setPhaseSteps([]);
      } else {
        setPhaseSteps(data || []);
      }
      setIsLoadingPhaseSteps(false);
    };

    fetchPhaseSteps();
  }, [step?.phase_id]); // Re-run when the current step's phase_id changes

  // 3. Handle Creation of Default Document if needed
  useEffect(() => {
    const createDefaultDocIfNeeded = async () => {
      if (!isLoadingResolution && !isLoadingStep && step && !activeDocumentId && projectId && resolvedStepId) {
        const newDocumentName = `${step.step_name} Document`;
        const { data: newDocData, error: createDocError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            step_id: resolvedStepId,
            document_name: newDocumentName,
            content: '',
            status: 'draft',
            current_version: 1,
            document_type: 'input',
          })
          .select('id')
          .single();

        if (createDocError) {
          showError(`Failed to create initial document: ${createDocError.message}`);
        } else {
          setActiveDocumentId(newDocData.id);
        }
      }
    };

    createDefaultDocIfNeeded();
  }, [isLoadingResolution, isLoadingStep, step, activeDocumentId, projectId, resolvedStepId]);

  // Sync with Sidebar/AI Panel Context
  useEffect(() => {
    if (resolvedStepId) setStepIdForAiPanel(resolvedStepId);
    if (activeDocumentId) setDocumentIdForAiPanel(activeDocumentId);
    
    return () => {
      setStepIdForAiPanel(undefined);
      setDocumentIdForAiPanel(undefined);
    };
  }, [resolvedStepId, activeDocumentId, setStepIdForAiPanel, setDocumentIdForAiPanel]);

  // Save to Local Storage
  useEffect(() => {
    if (projectId && resolvedStepId) {
      saveLastActiveStep(projectId, resolvedStepId, activeDocumentId);
    }
  }, [projectId, resolvedStepId, activeDocumentId]);

  // Calculate next/previous step IDs
  const { prevStep, nextStep } = useMemo(() => {
    if (!resolvedStepId || !phaseSteps.length) {
      return { prevStep: null, nextStep: null };
    }

    const currentIndex = phaseSteps.findIndex((s) => s.id === resolvedStepId);
    const prevStep = currentIndex > 0 ? phaseSteps[currentIndex - 1] : null;
    const nextStep = currentIndex < phaseSteps.length - 1 ? phaseSteps[currentIndex + 1] : null;

    return { prevStep, nextStep };
  }, [resolvedStepId, phaseSteps]);

  const handleNavigateToStep = (targetStepId: string) => {
    if (projectId) {
      navigate(`/dashboard/${projectId}/step/${targetStepId}`);
    }
  };

  if (isLoadingResolution || isLoadingStep || isLoadingPhaseSteps) { // Include new loading state
    return (
      <div className="flex flex-col h-full space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!step) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Step information could not be loaded.</p>
        <Button onClick={() => navigate(`/dashboard/${projectId}`)} className="mt-4">
          Back to Project
        </Button>
      </div>
    );
  }

  // Robust parsing for guiding questions
  const getGuidingQuestions = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(String);
    if (typeof data === 'string') {
      try {
        let parsed = JSON.parse(data);
        // If the first parse results in a string, try parsing again
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // If second parse fails, treat as a single string
            return parsed.trim().length > 0 ? [parsed] : [];
          }
        }
        if (Array.isArray(parsed)) return parsed.map(String);
        // If it parses to a string (e.g. '"question"'), treat as single item
        if (typeof parsed === 'string') return [parsed];
        return [];
      } catch {
        // If not JSON, treat the string itself as a single question if not empty
        return data.trim().length > 0 ? [data] : [];
      }
    }
    return [];
  };

  const dbGuidingQuestions = getGuidingQuestions(step.guiding_questions);
  
  // Fallback to static library if DB content is missing or empty
  const staticGuidance = stepGuidanceLibrary[step.step_name];
  const displayQuestions = dbGuidingQuestions.length > 0 
    ? dbGuidingQuestions 
    : (staticGuidance?.guiding_questions || []);
    
  const displayGoal = step.description || staticGuidance?.description || "No goal defined.";
  const displayWhyMatters = step.why_matters || staticGuidance?.why_matters || "No context provided.";

  console.log("Step Name:", step.step_name);
  console.log("DB Guiding Questions:", dbGuidingQuestions);
  console.log("Static Guidance for step name:", staticGuidance);
  console.log("Display Questions (final):", displayQuestions);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <Button
          variant="outline"
          onClick={() => prevStep && handleNavigateToStep(prevStep.id)}
          disabled={!prevStep}
        >
          Previous Step
        </Button>
        <Button
          variant="outline"
          onClick={() => nextStep && handleNavigateToStep(nextStep.id)}
          disabled={!nextStep}
        >
          Next Step
        </Button>
      </div>

      {/* Guidance Section - Fixed at top */}
      <div className="shrink-0 pb-4 z-10 bg-background">
        <Collapsible open={isGuidanceOpen} onOpenChange={setIsGuidanceOpen}>
          <Card className="w-full border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg font-bold">Guidance: {step.step_name}</CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 p-0">
                  {isGuidanceOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle Guidance</span>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            
            <CollapsibleContent>
              <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-4 animate-accordion-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Goal:</h3>
                    <p>{displayGoal}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Why it matters:</h3>
                    <p>{displayWhyMatters}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Guiding Questions:</h3>
                  {displayQuestions.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {displayQuestions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic text-muted-foreground">No specific questions for this step.</p>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Editor Section - Scrollable Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-20">
        {activeDocumentId ? (
          <DocumentEditor
            projectId={projectId}
            documentId={activeDocumentId}
            setAiReview={setAiReview}
            setIsAiReviewLoading={setIsAiReviewLoading}
          />
        ) : (
          <div className="text-center text-muted-foreground p-8 h-full flex items-center justify-center flex-col border rounded-md border-dashed bg-muted/10">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Initializing editor...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepWorkspace;