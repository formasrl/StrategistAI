import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface UseAutoSummarizeDocumentOptions {
  documentId?: string;
  projectId?: string;
  status?: string;
}

export const useAutoSummarizeDocument = ({
  documentId,
  projectId,
  status,
}: UseAutoSummarizeDocumentOptions) => {
  const isRunningRef = useRef(false);
  const lastSummarizedDocRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | undefined>(undefined);

  const triggerAutoSummarization = useCallback(async () => {
    if (!documentId || !projectId) {
      return;
    }

    if (isRunningRef.current || lastSummarizedDocRef.current === documentId) {
      return;
    }

    isRunningRef.current = true;
    showSuccess('Step 1/3 — Summarizing document…');
    showSuccess('Step 2/3 — Indexing…');

    try {
      const { error } = await supabase.functions.invoke('auto-summarize-document', {
        body: {
          document_id: documentId,
          project_id: projectId,
        },
      });

      if (error) {
        showError(`Summarization failed: ${error.message}`);
        return;
      }

      showSuccess('Step 3/3 — Done');
      lastSummarizedDocRef.current = documentId;
    } catch (err: any) {
      showError(`An unexpected error occurred: ${err?.message ?? 'Unknown error'}`);
    } finally {
      isRunningRef.current = false;
    }
  }, [documentId, projectId]);

  useEffect(() => {
    lastSummarizedDocRef.current = null;
    previousStatusRef.current = undefined;
  }, [documentId]);

  useEffect(() => {
    if (status === 'complete' && previousStatusRef.current !== 'complete') {
      void triggerAutoSummarization();
    }
    previousStatusRef.current = status;
  }, [status, triggerAutoSummarization]);

  return triggerAutoSummarization;
};