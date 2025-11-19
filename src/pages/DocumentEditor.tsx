import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import DocumentHeader from '@/components/documents/DocumentHeader';
import DocumentToolbar from '@/components/documents/DocumentToolbar';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StepSuggestionDialog from '@/components/documents/StepSuggestionDialog';
import { AiReview, Document } from '@/types/supabase';
import './DocumentEditor.css'; // Import custom CSS for Quill

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

interface SuggestedStep {
  step_id: string;
  step_name: string;
  description: string | null;
  score: number;
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
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [suggestedSteps, setSuggestedSteps] = useState<SuggestedStep[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const isPublished = status === ('published' as Document['status']);
  const isHistoricalView = viewingVersionContent !== null;

  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const versionLabel = useMemo(() => {
    const versionToDisplay = viewingVersionNumber ?? document?.current_version ?? '—';
    return `Version: ${versionToDisplay}`;
  }, [viewingVersionNumber, document?.current_version]);

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
    if (!document || isPublishing || isHistoricalView || isPublished) return;

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
    if (!document || isDisconnecting || isHistoricalView || !isPublished) return;

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

  const handleUploadFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isPublished || isHistoricalView) {
      showError('Cannot upload files when the document is published or viewing a historical version.');
      return;
    }

    setIsUploadingFile(true);
    const reader = new FileReader();
    let contentHtml = '';
    let rawTextContent = '';

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        contentHtml = result.value;
        rawTextContent = mammoth.extractRawText({ arrayBuffer }).value;
      } else if (fileExtension === 'html') {
        contentHtml = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        rawTextContent = new DOMParser().parseFromString(contentHtml, 'text/html').body.textContent || '';
      } else if (fileExtension === 'md') {
        const { marked } = await import('marked');
        const markdownText = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        contentHtml = await marked.parse(markdownText);
        rawTextContent = markdownText;
      } else {
        showError('Unsupported file type. Please upload .docx, .html, or .md files.');
        return;
      }

      const DOMPurify = (await import('dompurify')).default;
      const sanitizedHtml = DOMPurify.sanitize(contentHtml);

      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        const range = quill.getSelection(true);
        quill.clipboard.dangerouslyPasteHTML(range.index, sanitizedHtml);
        quill.setSelection(range.index + sanitizedHtml.length, 0);
        setContent(quill.root.innerHTML);
        showSuccess('File content inserted successfully!');

        if (currentProjectId && rawTextContent.trim()) {
          await fetchStepSuggestions(currentProjectId, rawTextContent);
        }
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      showError(`Failed to process file: ${error.message}`);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fetchStepSuggestions = async (projectId: string, documentContent: string) => {
    if (!projectId || !documentContent) return;

    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-step', {
        body: { projectId, documentContent },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        showError(`Failed to get step suggestions: ${error.message}`);
        setSuggestedSteps([]);
      } else if (data && data.suggestions) {
        setSuggestedSteps(data.suggestions);
        setIsSuggestionDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error invoking suggest-step:', error);
      showError(`An unexpected error occurred during step suggestion: ${error.message}`);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestedStep = async (newStepId: string) => {
    if (!document || isSaving) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          step_id: newStepId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);

      if (error) {
        throw new Error(`Failed to update document's step: ${error.message}`);
      }

      showSuccess('Document re-assigned to new step successfully!');
      setDocument((prev) => (prev ? { ...prev, step_id: newStepId } : null));
      setIsSuggestionDialogOpen(false);
      navigate(`/dashboard/${currentProjectId}/step/${newStepId}`);
    } catch (error: any) {
      showError(`Failed to re-assign document: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['link', 'image', 'uploadFile'],
          ['clean'],
        ],
        handlers: {
          uploadFile: handleUploadFileButtonClick,
        },
      },
    }),
    [handleUploadFileButtonClick],
  );

  const formats = useMemo(
    () => [
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
      'uploadFile',
    ],
    [],
  );

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

  const disableSave = isSaving || isPublished || isHistoricalView || isUploadingFile;
  const disablePublishDisconnect = isPublished
    ? isDisconnecting || isHistoricalView || isUploadingFile
    : isPublishing || isSaving || isHistoricalView || isUploadingFile;
  const disableDelete = isDeleting || isHistoricalView || isUploadingFile;
  const showPublishedBanner = isPublished && !isHistoricalView;

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between">
          <DocumentHeader
            title={document.document_name}
            versionLabel={versionLabel}
            isHistoricalView={isHistoricalView}
            isPublished={isPublished}
          />
          <div className="flex items-center gap-2">
            <Button
              id="tour-upload-document"
              onClick={handleUploadFileButtonClick}
              variant="outline"
              disabled={isPublished || isHistoricalView || isUploadingFile}
            >
              {isUploadingFile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Upload File
            </Button>
            <DocumentToolbar
              showBackButton={isHistoricalView}
              onBackToLatest={handleBackToLatest}
              isSaving={isSaving}
              onSave={handleSave}
              disableSave={disableSave}
              isPublished={isPublished}
              onPublish={handlePublish}
              onDisconnect={handleDisconnect}
              isPublishing={isPublishing}
              isDisconnecting={isDisconnecting}
              disablePublishDisconnect={disablePublishDisconnect}
              onDelete={handleDeleteDocument}
              isDeleting={isDeleting}
              disableDelete={disableDelete}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0 relative min-h-[300px]">
          {showPublishedBanner && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              This document is published to RAG and locked for edits. Use “Disconnect” to make changes again.
            </div>
          )}
          {isUploadingFile && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing file...
            </div>
          )}
          <ReactQuill
            key={document.id + (isHistoricalView ? '-history' : '-current')}
            ref={quillRef}
            theme="snow"
            value={isHistoricalView ? viewingVersionContent ?? '' : content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            readOnly={isHistoricalView || isPublished || isUploadingFile}
            placeholder="Start writing your document here..."
            className="quill-editor-container"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".docx,.html,.md"
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

      {document && (
        <StepSuggestionDialog
          isOpen={isSuggestionDialogOpen}
          onClose={() => setIsSuggestionDialogOpen(false)}
          suggestions={suggestedSteps}
          onSelectStep={handleSelectSuggestedStep}
          currentStepId={document.step_id}
          isLoading={isLoadingSuggestions}
        />
      )}
    </div>
  );
};

export default DocumentEditor;