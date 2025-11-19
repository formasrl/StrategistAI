import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Step, AiReview } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import DocumentEditor from './DocumentEditor';

interface StepWorkspaceOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
  setDocumentIdForAiPanel: (docId: string | undefined) => void;
  setStepIdForAiPanel: (stepId: string | undefined) => void;
  setChatSessionIdForAiPanel: (sessionId: string | undefined) => void; // New setter
}

const StepWorkspace: React.FC = () => {
  const { projectId, stepId } = useParams<{ projectId: string; stepId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const [isLoadingStep, setIsLoadingStep] = useState(true);
  const [primaryDocumentId, setPrimaryDocumentId] = useState<string | undefined>(undefined);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>(undefined); // New state for chat session

  const {
    setAiReview,
    setIsAiReviewLoading,
    setDocumentIdForAiPanel,
    setStepIdForAiPanel,
    setChatSessionIdForAiPanel, // Destructure new setter
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

  // Pass chatSessionId to the AI panel
  useEffect(() => {
    setChatSessionIdForAiPanel(chatSessionId);
    return () => {
      setChatSessionIdForAiPanel(undefined);
    };
  }, [chatSessionId, setChatSessionIdForAiPanel]);

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

      let docIdToUse: string | undefined;
      if (existingDocuments && existingDocuments.length > 0) {
        docIdToUse = existingDocuments[0].id;
        setPrimaryDocumentId(docIdToUse);
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
        docIdToUse = newDocData.id;
        setPrimaryDocumentId(docIdToUse);
        showSuccess(`Created a new document for "${stepData.step_name}".`);
      }
      setIsLoadingDocument(false);

      // Fetch existing chat session for this step/project or set to undefined
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('project_id', projectId)
        .eq('step_id', stepId)
        .maybeSingle();

      if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching chat session:', sessionError);
        setChatSessionId(undefined);
      } else if (sessionData) {
        setChatSessionId(sessionData.id);
      } else {
        setChatSessionId(undefined);
      }
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

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <Lightbulb className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-xl font-bold">Guidance: {step.step_name}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-2">
          {step.description && (
            <div>
              <h3 className="font-semibold text-foreground">What this step is about:</h3>
              <p>{step.description}</p>
            </div>
          )}
          {step.why_matters && (
            <div>
              <h3 className="font-semibold text-foreground">Why it matters:</h3>
              <p>{step.why_matters}</p>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-foreground">Guiding Questions:</h3>
            <ul className="list-disc pl-5">
              <li>What is the core purpose of this brand?</li>
              <li>Who is the primary target audience?</li>
              <li>What makes this brand unique compared to competitors?</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Expected Output:</h3>
            <p>A concise document outlining the key strategic decisions for "{step.step_name}".</p>
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