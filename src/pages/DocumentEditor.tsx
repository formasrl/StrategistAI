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
import './DocumentEditor.css';
import { cn } from '@/lib/utils';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { saveLastActiveStep } from '@/utils/localStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

type DashboardOutletContext = {
  setAiReview?: (review: AiReview | null) => void;
  setIsAiReviewLoading?: (isLoading: boolean) => void;
  setDocumentIdForAiPanel?: (docId: string | undefined) => void;
  setStepIdForAiPanel?: (stepId: string | undefined) => void;
  setContentToInsert?: (content: string | null) => void;
  contentToInsert?: string | null;
  handleAttemptInsertContent?: (content: string) => void; // New prop for AI Chatbot
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

  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('findDOMNode')) {
        return;
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  const outletContext = useOutletContext<DashboardOutletContext | undefined>();
  const {
    setAiReview: contextSetAiReview,
    setIsAiReviewLoading: contextSetIsAiReviewLoading,
    setDocumentIdForAiPanel: contextSetDocumentIdForAiPanel,
    setStepIdForAiPanel: contextSetStepIdForAiPanel,
    contentToInsert,
    setContentToInsert,
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

  const [document, setDocument] = useState<Document | null>(null);

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

  useEffect(() => {
    if (document?.step_id) {
      contextSetStepIdForAiPanel?.(document.step_id);
      if (currentProjectId && document.step_id && currentDocumentId) {
        saveLastActiveStep(currentProjectId, document.step_id, currentDocumentId);
      }
    }
  }, [document?.step_id, currentProjectId, currentDocumentId, contextSetStepIdForAiPanel]);

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

  // New state for handling AI content insertion into published document
  const [isConfirmingInsertDisconnect, setIsConfirmingInsertDisconnect] = useState(false);
  const [contentToInsertAfterDisconnect, setContentToInsertAfterDisconnect] = useState<string | null>(null);

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

  const insertContentIntoEditor = useCallback(async (newContent: string) => {
    if (!quillRef.current) return;

    const quill = quillRef.current.getEditor();
    
    // Convert Markdown to HTML
    const htmlContent = await marked.parse(newContent);
    const sanitizedHtml = DOMPurify.sanitize(htmlContent);

    // Clear the editor first
    quill.setText('');
    
    // Insert the new content
    quill.clipboard.dangerouslyPasteHTML(0, sanitizedHtml);
    
    // Move cursor to end
    const length = quill.getLength();
    quill.setSelection(length, 0);
    
    // Update state explicitly
    setContent(quill.root.innerHTML);
    
    // Clear any pending content and close dialog
    setContentToInsertAfterDisconnect(null);
    setIsConfirmingInsertDisconnect(false);

    showSuccess('Editor content replaced with AI generated text.');
  }, []);

  // Effect to handle content from AI Panel
  useEffect(() => {
    if (contentToInsert && document) {
      handleAttemptInsertContent(contentToInsert);
      setContentToInsert?.(null); // Clear the content from context after handling
    }
  }, [contentToInsert, document, setContentToInsert]);


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
    let contentHtml = '';
    let rawTextContent = '';

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        contentHtml = result.value;
        rawTextContent = mammoth.extractRawText({ arrayBuffer }).value;
      } else if (fileExtension === 'html') {
        contentHtml = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        rawTextContent = new DOMParser().parseFromString(contentHtml, 'text/html').body.textContent || '';
      } else if (fileExtension === 'md') {
        const markdownText = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        contentHtml = await marked.parse(markdownText);
        rawTextContent = markdownText;
      } else if (fileExtension === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 10); 
        
        for (let p = 1; p <= maxPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        }
        
        if (pdf.numPages > maxPages) {
          fullText += `\n[...PDF truncated after ${maxPages} pages...]`;
        }
        contentHtml = await marked.parse(fullText);
        rawTextContent = fullText;
      } else {
        showError('Unsupported file type. Please upload .docx, .html, .md, or .pdf files.');
        return;
      }

      const sanitizedHtml = DOMPurify.sanitize(contentHtml);

      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        
        quill.clipboard.dangerouslyPasteHTML(index, sanitizedHtml);
        quill.setSelection(index + sanitizedHtml.length, 0);
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

  const handleDownload = async (format: 'txt' | 'html' | 'pdf') => {
    if (!document || !isPublished) {
      showError('Document must be published to download.');
      return;
    }

    const fileName = `${document.document_name.replace(/\s/g, '_')}_v${document.current_version}`;
    const currentContent = viewingVersionContent || content;

    if (!currentContent) {
      showError('No content available to download.');
      return;
    }

    try {
      if (format === 'txt') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Document downloaded as TXT.');
      } else if (format === 'html') {
        const blob = new Blob([currentContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Document downloaded as HTML.');
      } else if (format === 'pdf') {
        showSuccess('Generating PDF, please wait...');
        const editorElement = quillRef.current?.getEditor().root;
        if (!editorElement) {
          throw new Error('Quill editor element not found for PDF generation.');
        }

        const canvas = await html2canvas(editorElement, {
          scale: 2,
          useCORS: true,
          windowWidth: editorElement.scrollWidth,
          windowHeight: editorElement.scrollHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'pt',
          format: 'a4',
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`${fileName}.pdf`);
        showSuccess('Document downloaded as PDF.');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      showError(`Failed to download document: ${error.message}`);
    }
  };

  // New function to handle content insertion from AI Chatbot
  const handleAttemptInsertContent = useCallback(async (newContent: string) => {
    if (!document) {
      showError('No document is active to insert content into.');
      return;
    }

    if (document.status === 'published') {
      setContentToInsertAfterDisconnect(newContent);
      setIsConfirmingInsertDisconnect(true);
    } else {
      await insertContentIntoEditor(newContent);
    }
  }, [document, insertContentIntoEditor]);

  // Expose handleAttemptInsertContent via context
  useEffect(() => {
    if (outletContext && outletContext.handleAttemptInsertContent !== handleAttemptInsertContent) {
      // This is a bit of a hack to update the context function if it changes,
      // but it's necessary for the AI Chatbot to call the latest version.
      // In a real app, you might use a more robust context management solution.
      (outletContext as DashboardOutletContext).handleAttemptInsertContent = handleAttemptInsertContent;
    }
  }, [outletContext, handleAttemptInsertContent]);


  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['link', 'image'],
        ['clean'],
      ],
    }),
    [],
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
    <div className="flex flex-col space-y-4">
      <Card className="w-full flex flex-col">
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
              title="Supported formats: .docx, .html, .md, .pdf"
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
              onDownload={handleDownload}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col p-6 pt-0 relative min-h-[500px]">
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
            className={cn("quill-editor-container", "flex-1")}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".docx,.html,.md,.pdf"
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

      {/* AlertDialog for disconnecting from RAG */}
      <AlertDialog open={isConfirmingInsertDisconnect} onOpenChange={setIsConfirmingInsertDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from RAG?</AlertDialogTitle>
            <AlertDialogDescription>
              This document is currently published to RAG (Read-A-Document). To insert new content,
              it must first be disconnected, making it editable again. This will remove its current
              summary and key decisions from AI memory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!document || !contentToInsertAfterDisconnect) return;
                setIsDisconnecting(true);
                const disconnectResult = await syncDocumentMemory('disconnect');
                setIsDisconnecting(false);

                if (disconnectResult.ok) {
                  showSuccess('Document disconnected from RAG.');
                  setStatus('draft' as Document['status']);
                  setDocument((prev) => (prev ? { ...prev, status: 'draft' } : null));
                  await insertContentIntoEditor(contentToInsertAfterDisconnect);
                } else {
                  showError(`Failed to disconnect from RAG: ${disconnectResult.message}`);
                  setContentToInsertAfterDisconnect(null); // Clear content if disconnect fails
                }
              }}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Yes, Disconnect & Insert'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentEditor;