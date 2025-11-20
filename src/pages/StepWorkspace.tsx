import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Step, AiReview } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import DocumentEditor from './DocumentEditor';
import { stepGuidanceLibrary, StepGuidance } from '@/utils/stepGuidanceData';

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

  const {
    setAiReview,
    setIsAiReviewLoading,
    setDocumentIdForAiPanel,
    setStepIdForAiPanel,
  } = useOutletContext<StepWorkspaceOutletContext>();

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
        // Toast removed
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

  // Look up guidance based on the step name
  const staticGuidance: StepGuidance | undefined = stepGuidanceLibrary[step.step_name];

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <Lightbulb className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-xl font-bold">Guidance: {step.step_name}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-4">
          
          {/* Description */}
          <div>
            <h3 className="font-semibold text-foreground">What this step is about:</h3>
            <p>{staticGuidance?.description || step.description || "No description available."}</p>
          </div>
          
          {/* Why it Matters */}
          <div>
            <h3 className="font-semibold text-foreground">Why it matters:</h3>
            <p>{staticGuidance?.why_matters || step.why_matters || "No context available."}</p>
          </div>
          
          {/* Guiding Questions */}
          <div>
            <h3 className="font-semibold text-foreground">Guiding Questions:</h3>
            {staticGuidance?.guiding_questions && staticGuidance.guiding_questions.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1">
                {staticGuidance.guiding_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            ) : (
              <p>No specific guiding questions available for this step yet.</p>
            )}
          </div>

          {/* Expected Output */}
          <div>
            <h3 className="font-semibold text-foreground">Expected Output:</h3>
            <p className="font-medium text-primary">
              {staticGuidance?.expected_output || 
               `A concise document outlining the key strategic decisions for "${step.step_name}".`}
            </p>
          </div>
        </CardContent>
      </Card>

      {primaryDocumentId ? (
        <DocumentEditor
          projectId={projectId}
          documentId={primaryDocumentId}
          setAiReview={setAiReview}
          setIsAiReviewLoading={setIsAiReviewLoading}
        />
      ) : (
        <div className="text-center text-muted-foreground p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Preparing document editor...</p>
        </div>
      )}
    </div>
  );
};

export default StepWorkspace;