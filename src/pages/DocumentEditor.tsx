import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Document, AiReview } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Save, Loader2, RotateCcw, Trash2, UploadCloud, Link2Off } from 'lucide-react';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

type DashboardOutletContext = {
  setAiReview?: (review: AiReview | null) => void;
  setIsAiReviewLoading?: (isLoading: boolean) => void;
  setDocumentIdForAiPanel?: (docId: string | undefined) => void;
  setStepIdForAiPanel?: (stepId: string | undefined) => void;
};

interface DocumentEditorProps {
  projectId?: string;
  documentId?: string;
  setAiReview?: (review: AiReview | null) => void;
  setIsAiReviewLoading?: (isLoading: boolean) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  projectId: propProjectId,
  documentId: propDocumentId,
  setAiReview: setAiReviewProp,
  setIsAiReviewLoading: setIsAiReviewLoadingProp,
}) => {
  const routeParams = useParams<{ projectId: string; documentId: string }>();
  const currentProjectId = propProjectId ?? routeParams.projectId;
  const currentDocumentId = propDocumentId ?? routeParams.documentId;
  const navigate = useNavigate();

  const outletContext = useOutletContext<DashboardOutletContext | undefined>();
  const {
    setAiReview: contextSetAiReview,
    setIsAiReviewLoading: contextSetIsAiReviewLoading,
    setDocumentIdForAiPanel: contextSetDocumentIdForAiPanel,
    setStepIdForAiPanel: contextSetStepIdForAiPanel,
  } = outletContext ?? {};

  const setAiReviewFn = useCallback(
    (review: AiReview | null) => {
      if (setAiReviewProp) {
        setAiReviewProp(review);
        return;
      }
      contextSetAiReview?.(review);
    },
    [setAiReviewProp, contextSetAiReview],
  );

  const setIsAiReviewLoadingFn = useCallback(
    (value: boolean) => {
      if (setIsAiReviewLoadingProp) {
        setIsAiReviewLoadingProp(value);
        return;
      }
      contextSetIsAiReviewLoading?.(value);
    },
    [setIsAiReviewLoadingProp, contextSetIsAiReviewLoading],
  );

  useEffect(() => {
    contextSetStepIdForAiPanel?.(undefined);
  }, [contextSetStepIdForAiPanel]);

  useEffect(() => {
    if (currentDocumentId) {
      contextSetDocumentIdForAiPanel?.(currentDocumentId);
    } else {
      contextSetDocumentIdForAiPanel?.(undefined);
    }
    return () => {
      contextSetDocumentIdForAiPanel?.(undefined);
    };
  }, [currentDocumentId, contextSetDocumentIdForAiPanel]);

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<Document['status']>('draft' as Document['status']);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  const isPublished = status === ('published' as Document['status']);

  const syncDocumentMemory = useCallback(
    async (action: 'publish' | 'disconnect'): Promise<{ ok: boolean; message?: string }> => {
      if (!currentDocumentId) {
        return { ok: false, message: 'Missing document identifier for memory sync.' };
      }

      const { error } = await supabase.functions.invoke('process-document-publish', {
        body: { documentId: currentDocumentId, action },
      });

      if (error) {
        console.error('Memory sync error', error);
        return { ok: false, message: error.message ?? 'Unknown memory sync error.' };
      }

      return { ok: true };
    },
    [currentDocumentId],
  );

  const fetchDocument = useCallback(async () => {
    if (!currentDocumentId) {
      setIsLoadingDocument(false);
      setDocument(null);
      setContent('');
      setStatus('draft' as Document['status']);
      setViewingVersionContent(null);
      setViewingVersionNumber(null);
      setAiReviewFn(null);
      setIsAiReviewLoadingFn(false);
      return;
    }

    setIsLoadingDocument(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', currentDocumentId)
      .single();

    if (error) {
      showError(`Failed to load document: ${error.message}`);
      setDocument(null);
      setContent('');
      setStatus('draft' as Document['status']);
      setViewingVersionContent(null);
      setViewingVersionNumber(null);
      setAiReviewFn(null);
      setIsAiReviewLoadingFn(false);
    } else {
      setDocument(data);
      setContent(data?.content || '');
      setStatus((data?.status as Document['status']) || ('draft' as Document['status']));
      setViewingVersionContent(null);
      setViewingVersionNumber(data?.current_version || null);
    }
    setIsLoadingDocument(false);
  }, [currentDocumentId, setAiReviewFn, setIsAiReviewLoadingFn]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleSave = async () => {
    if (!document || isSaving || isPublished) return;

    setIsSaving(true);
    try {
      const newVersionNumber = (document.current_version || 0) + 1;

      const { error: versionError } = await supabase.from('document_versions').insert({
        document_id: document.id,
        content: content,
        version: newVersionNumber,
        change_description: `Saved version ${newVersionNumber}`,
      });

      if (versionError) {
        throw new Error(`Failed to create document version: ${versionError.message}`);
      }

      const { error: documentUpdateError } = await supabase
        .from('documents')
        .update({
          content: content,
          current_version: newVersionNumber,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);

      if (documentUpdateError) {
        throw new Error(`Failed to update document: ${documentUpdateError.message}`);
      }

      showSuccess('Document saved successfully.');
      setDocument((prev) =>
        prev ? { ...prev, content: content, current_version: newVersionNumber, status: status } : null,
      );
      setViewingVersionContent(null);
      setViewingVersionNumber(newVersionNumber);
    } catch (error: any) {
      showError(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!document || isPublishing || !!viewingVersionContent || isPublished) return;

    setIsPublishing(true);
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id);

    if (error) {
      showError(`Publish failed: ${error.message}`);
      setIsPublishing(false);
      return;
    }

    const syncResult = await syncDocumentMemory('publish');

    const newStatus = 'published' as Document['status'];
    setStatus(newStatus);
    setDocument((prev) => (prev ? { ...prev, status: newStatus } : null));

    if (syncResult.ok) {
      showSuccess('Document published and project memory updated.');
    } else {
      showSuccess('Document published.');
      showError(`Memory sync failed: ${syncResult.message}`);
    }

    setIsPublishing(false);
  };

  const handleDisconnect = async () => {
    if (!document || isDisconnecting || !isPublished) return;

    setIsDisconnecting(true);
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id);

    if (error) {
      showError(`Disconnect failed: ${error.message}`);
      setIsDisconnecting(false);
      return;
    }

    const syncResult = await syncDocumentMemory('disconnect');

    const newStatus = 'draft' as Document['status'];
    setStatus(newStatus);
    setDocument((prev) => (prev ? { ...prev, status: newStatus } : null));
    setViewingVersionContent(null);
    setViewingVersionNumber(document.current_version || null);

    if (syncResult.ok) {
      showSuccess('Document disconnected and removed from memory.');
    } else {
      showSuccess('Document disconnected.');
      showError(`Memory cleanup failed: ${syncResult.message}`);
    }

    setIsDisconnecting(false);
  };

  const handleDeleteDocument = async () => {
    if (!currentDocumentId || isDeleting) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', currentDocumentId);

      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }

      showSuccess('Document deleted successfully!');
      setAiReviewFn(null);
      setIsAiReviewLoadingFn(false);
      navigate(`/dashboard/${currentProjectId}`);
    } catch (error: any) {
      showError(`Delete failed: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewHistoricalVersion = (versionContent: string, versionNumber: number) => {
    setViewingVersionContent(versionContent);
    setViewingVersionNumber(versionNumber);
    showSuccess(`Viewing historical version ${versionNumber}.`);
  };

  const handleBackToLatest = () => {
    setViewingVersionContent(null);
    setViewingVersionNumber(document?.current_version || null);
    showSuccess('Switched back to the latest document version.');
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'list',
    'bullet',
    'indent',
    'link',
    'image',
  ];

  if (isLoadingDocument) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-4">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!document) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Document not found or an error occurred.</p>
      </div>
    );
  }

  const publishDisconnectDisabled = isPublished
    ? isDisconnecting || !!viewingVersionContent
    : isPublishing || isSaving || !!viewingVersionContent;

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">{document.document_name}</CardTitle>
            <CardDescription className="text-muted-foreground">
              Version: {viewingVersionNumber}
              {viewingVersionContent && (
                <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Historical View)</span>
              )}
            </CardDescription>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant={isPublished ? 'secondary' : 'outline'}
                className={isPublished ? 'bg-emerald-500 text-white hover:bg-emerald-500/80' : ''}
              >
                {isPublished ? 'Published to RAG (read-only)' : 'Editable'}
              </Badge>
              {!isPublished && (
                <span className="text-xs text-muted-foreground">Use Publish to surface in RAG.</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewingVersionContent && (
              <Button onClick={handleBackToLatest} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" /> Back to Latest
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || isPublished || !!viewingVersionContent}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save
                </>
              )}
            </Button>
            <Button
              onClick={isPublished ? handleDisconnect : handlePublish}
              variant={isPublished ? 'outline' : 'secondary'}
              disabled={publishDisconnectDisabled}
            >
              {isPublished ? (
                isDisconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disconnecting...
                  </>
                ) : (
                  <>
                    <Link2Off className="mr-2 h-4 w-4" /> Disconnect
                  </>
                )
              ) : isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Publish
                </>
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" disabled={isDeleting || !!viewingVersionContent}>
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  <span className="sr-only">Delete Document</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this document
                    and all its associated versions and AI reviews.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteDocument}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
          {isPublished && !viewingVersionContent && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              This document is published to RAG and locked for edits. Use “Disconnect” to make changes again.
            </div>
          )}
          <ReactQuill
            theme="snow"
            value={viewingVersionContent !== null ? viewingVersionContent : content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            readOnly={!!viewingVersionContent || isPublished}
            placeholder="Start writing your document here..."
            className="flex-1 min-h-[300px] flex flex-col"
          />
        </CardContent>
      </Card>

      {currentDocumentId && document.current_version !== undefined && (
        <DocumentVersionList
          documentId={currentDocumentId}
          currentVersionNumber={document.current_version}
          onViewVersion={handleViewHistoricalVersion}
        />
      )}
    </div>
  );
};

export default DocumentEditor;