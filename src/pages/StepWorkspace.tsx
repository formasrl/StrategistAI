import React, { useEffect, useState } from 'react';
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

interface StepWorkspaceOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
  setDocumentIdForAiPanel: (docId: string | undefined) => void;
  setStepIdForAiPanel: (stepId: string | undefined) => void;
}

const StepWorkspace: React.FC = () => {
  const { projectId, stepId } = useParams<{ projectId: string; stepId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const [isLoadingStep, setIsLoadingStep] = useState(true);
  const [primaryDocumentId, setPrimaryDocumentId] = useState<string | undefined>(undefined);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(true); // Default to open

  const {
    setAiReview,
    setIsAiReviewLoading,
    setDocumentIdForAiPanel,
    setStepIdForAiPanel,
  } = useOutletContext<StepWorkspaceOutletContext>();

  // Save last active step to local storage
  useEffect(() => {
    if (projectId && stepId) {
      saveLastActiveStep(projectId, stepId);
    }
  }, [projectId, stepId]);

  useEffect(() => {
    setStepIdForAiPanel(stepId);
    return () => {
      setStepIdForAiPanel(undefined);
    };
  }, [stepId, setStepIdForAiPanel]);

  useEffect(() => {
    setDocumentIdForAiPanel(primaryDocumentId);
    return () => {
      setDocumentIdForAiPanel(undefined);
    };
  }, [primaryDocumentId, setDocumentIdForAiPanel]);

  useEffect(() => {
    const fetchStepAndDocument = async () => {
      if (!stepId || !projectId) {
        setIsLoadingStep(false);
        setIsLoadingDocument(false);
        return;
      }

      setIsLoadingStep(true);
      setIsLoadingDocument(true);

      const { data: stepData, error: stepError } = await supabase
        .from('steps')
        .select('*')
        .eq('id', stepId)
        .single();

      if (stepError) {
        showError(`Failed to load step details: ${stepError.message}`);
        setStep(null);
        setIsLoadingStep(false);
        setIsLoadingDocument(false);
        return;
      }
      setStep(stepData);
      setIsLoadingStep(false);

      const { data: existingDocuments, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('step_id', stepId)
        .limit(1);

      if (docError) {
        showError(`Failed to check for existing documents: ${docError.message}`);
        setIsLoadingDocument(false);
        return;
      }

      if (existingDocuments && existingDocuments.length > 0) {
        setPrimaryDocumentId(existingDocuments[0].id);
      } else {
        const newDocumentName = `${stepData.step_name} Document`;
        const { data: newDocData, error: createDocError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            step_id: stepId,
            document_name: newDocumentName,
            content: '',
            status: 'draft',
            current_version: 1,
            document_type: 'input',
          })
          .select('id')
          .single();

        if (createDocError) {
          showError(`Failed to create initial document for step: ${createDocError.message}`);
          setIsLoadingDocument(false);
          return;
        }
        setPrimaryDocumentId(newDocData.id);
      }
      setIsLoadingDocument(false);
    };

    fetchStepAndDocument();
  }, [projectId, stepId, setDocumentIdForAiPanel, setStepIdForAiPanel]);

  if (isLoadingStep || isLoadingDocument) {
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
        <p>Step not found or an error occurred.</p>
        <Button onClick={() => navigate(`/dashboard/${projectId}`)} className="mt-4">
          Back to Project
        </Button>
      </div>
    );
  }

  const guidingQuestions = (step.guiding_questions as string[]) || [];

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Guidance Section - Fixed at top (shrink-0) */}
      <div className="shrink-0">
        <Collapsible open={isGuidanceOpen} onOpenChange={setIsGuidanceOpen}>
          <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-xl font-bold">Guidance: {step.step_name}</CardTitle>
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
            
            {/* If collapsed, we show nothing extra. If open, we show content. */}
            <CollapsibleContent>
              <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-4 animate-accordion-down">
                {/* Description */}
                <div>
                  <h3 className="font-semibold text-foreground">What this step is about:</h3>
                  <p>{step.description}</p>
                </div>
                
                {/* Why it Matters */}
                <div>
                  <h3 className="font-semibold text-foreground">Why it matters:</h3>
                  <p>{step.why_matters}</p>
                </div>
                
                {/* Guiding Questions */}
                <div>
                  <h3 className="font-semibold text-foreground">Guiding Questions:</h3>
                  {guidingQuestions.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {guidingQuestions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic">No specific questions for this step.</p>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Editor Section - Fills remaining space */}
      <div className="flex-1 min-h-0">
        {primaryDocumentId ? (
          <DocumentEditor
            projectId={projectId}
            documentId={primaryDocumentId}
            setAiReview={setAiReview}
            setIsAiReviewLoading={setIsAiReviewLoading}
          />
        ) : (
          <div className="text-center text-muted-foreground p-8 h-full flex items-center justify-center flex-col border rounded-md border-dashed">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Preparing document editor...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepWorkspace;