import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { useSupabaseQuery } from './useSupabaseQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

/**
 * @name useDocument
 * @description A custom hook for fetching and managing a single document.
 * @param documentId The ID of the document to fetch.
 * @returns {object} The document, its loading state, its content, and functions to update it.
 */
export const useDocument = (documentId: string | undefined) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: document, isLoading: isLoadingDocument } = useSupabaseQuery(
    ['document', documentId],
    () => {
      if (!documentId) return Promise.resolve({ data: null, error: null });
      return supabase.from('documents').select('*').eq('id', documentId).single();
    }
  );

  const [content, setContent] = useState<string>('');

  useEffect(() => {
    if (document) {
      setContent(document.content || '');
    }
  }, [document]);

  const { mutate: saveDocument, isPending: isSaving } = useMutation({
    mutationFn: async (newContent: string) => {
      if (!document) return;
      const newVersionNumber = (document.current_version || 0) + 1;

      const { error: versionError } = await supabase.from('document_versions').insert({
        document_id: document.id,
        content: newContent,
        version: newVersionNumber,
        change_description: `Saved version ${newVersionNumber}`,
      });
      if (versionError) throw new Error(versionError.message);

      const { error: documentUpdateError } = await supabase
        .from('documents')
        .update({
          content: newContent,
          current_version: newVersionNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);
      if (documentUpdateError) throw new Error(documentUpdateError.message);
    },
    onSuccess: () => {
      showSuccess('Document saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documentVersions', documentId] });
    },
    onError: (error) => {
      showError(`Save failed: ${error.message}`);
    },
  });

  const { mutate: updateDocumentStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: async (status: 'published' | 'draft') => {
      if (!document) return;
      const { error } = await supabase
        .from('documents')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', document.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, status) => {
      showSuccess(`Document ${status}.`);
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
    onError: (error) => {
      showError(`Failed to update document status: ${error.message}`);
    },
  });

  const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      if (!documentId) return;
      const { error } = await supabase.from('documents').delete().eq('id', documentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess('Document deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      navigate(`/dashboard/${document?.project_id}`);
    },
    onError: (error) => {
      showError(`Delete failed: ${error.message}`);
    },
  });


  return {
    document,
    isLoadingDocument,
    content,
    setContent,
    saveDocument,
    isSaving,
    updateDocumentStatus,
    isUpdatingStatus,
    deleteDocument,
    isDeleting,
  };
};
