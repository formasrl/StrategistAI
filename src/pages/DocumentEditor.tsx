import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import DocumentHeader from '@/components/documents/DocumentHeader';
import DocumentToolbar from '@/components/documents/DocumentToolbar';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { FileUp, Loader2 } from 'lucide-react'; // Import FileUp icon

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
  const [isUploadingFile, setIsUploadingFile] = useState(false); // New state for file upload

  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  const isPublished = status === ('published' as Document['status']);
  const isHistoricalView = viewingVersionContent !== null;

  const quillRef = useRef<ReactQuill>(null); // Ref for ReactQuill instance
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

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

  // File upload logic
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

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        contentHtml = result.value;
      } else if (fileExtension === 'html') {
        contentHtml = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
      } else if (fileExtension === 'md') {
        const markdownText = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        contentHtml = marked.parse(markdownText);
      } else {
        showError('Unsupported file type. Please upload .docx, .html, or .md files.');
        return;
      }

      // Sanitize HTML before inserting
      const sanitizedHtml = DOMPurify.sanitize(contentHtml);

      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        const range = quill.getSelection(true);
        quill.clipboard.dangerouslyPasteHTML(range.index, sanitizedHtml);
        quill.setSelection(range.index + sanitizedHtml.length, 0); // Move cursor after inserted content
        setContent(quill.root.innerHTML); // Update local state with new content
        showSuccess('File content inserted successfully!');
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      showError(`Failed to process file: ${error.message}`);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the file input
      }
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
          ['link', 'image', 'uploadFile'], // Add 'uploadFile' here
          ['clean'],
        ],
        handlers: {
          uploadFile: handleUploadFileButtonClick, // Custom handler
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
      'uploadFile', // Add custom format here
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
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
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
            ref={quillRef}
            theme="snow"
            value={isHistoricalView ? viewingVersionContent ?? '' : content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            readOnly={isHistoricalView || isPublished || isUploadingFile}
            placeholder="Start writing your document here..."
            className="flex-1 min-h-[300px] flex flex-col"
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
    </div>
  );
};

export default DocumentEditor;