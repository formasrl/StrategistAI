import React, { useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Step } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2 } from 'lucide-react';
import DocumentEditor from './DocumentEditor';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const StepWorkspace: React.FC = () => {
  const { projectId, stepId } = useParams<{ projectId: string; stepId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setDocumentIdForAiPanel, setStepIdForAiPanel } = useOutletContext<any>();

  useEffect(() => {
    setStepIdForAiPanel(stepId);
    return () => setStepIdForAiPanel(undefined);
  }, [stepId, setStepIdForAiPanel]);

  const { data: step, isLoading: isLoadingStep } = useSupabaseQuery(
    ['step', stepId],
    () => supabase.from('steps').select('*').eq('id', stepId!).single()
  );

  const { data: document, isLoading: isLoadingDocument } = useSupabaseQuery(
    ['documentForStep', stepId],
    () => supabase.from('documents').select('id').eq('step_id', stepId!).limit(1).single()
  );

  const { mutate: createDocument, isPending: isCreatingDocument } = useMutation({
    mutationFn: async () => {
      const newDocumentName = `${step?.step_name} Document`;
      const { data, error } = await supabase
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
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      showSuccess(`Created a new document for "${step?.step_name}".`);
      queryClient.setQueryData(['documentForStep', stepId], data);
    },
    onError: (error) => {
      showError(`Failed to create initial document: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!isLoadingDocument && !document && step) {
      createDocument();
    }
  }, [isLoadingDocument, document, step, createDocument]);

  useEffect(() => {
    if (document) {
      setDocumentIdForAiPanel(document.id);
    }
    return () => setDocumentIdForAiPanel(undefined);
  }, [document, setDocumentIdForAiPanel]);

  if (isLoadingStep || isLoadingDocument || isCreatingDocument) {
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
          {step.description && <p>{step.description}</p>}
        </CardContent>
      </Card>

      {document?.id ? (
        <DocumentEditor documentId={document.id} />
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
