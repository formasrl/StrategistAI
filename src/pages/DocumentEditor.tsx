import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Document, AiReview } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Save, Brain, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import Quill styles

// Define props for when DocumentEditor is rendered directly (e.g., by StepWorkspace)
interface DocumentEditorProps {
  projectId?: string; // Make optional for direct route
  documentId?: string; // Make optional for direct route
  setAiReview?: (review: AiReview | null) => void;
  setIsAiReviewLoading?: (isLoading: boolean) => void;
}

// Define a local context type for DocumentEditor when used as a standalone route
interface DocumentEditorLocalOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  projectId: propProjectId,
  documentId: propDocumentId,
  setAiReview: propSetAiReview,
  setIsAiReviewLoading: propSetIsAiReviewLoading,
}) => {
  // Use params for routing, or props if rendered directly
  const routeParams = useParams<{ projectId: string; documentId: string }>();
  const currentProjectId = propProjectId || routeParams.projectId;
  const currentDocumentId = propDocumentId || routeParams.documentId;
  const navigate = useNavigate();

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<Document['status']>('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiReview, setAiReviewState] = useState<AiReview | null>(null);
  const [isLoadingAiReview, setIsLoadingAiReviewState] = useState(false);

  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  // Try to get context from Outlet if props are not provided
  let contextSetAiReview: ((review: AiReview | null) => void) | undefined;
  let contextSetIsAiReviewLoading: ((isLoading: boolean) => void) | undefined;
  try {
    // This will only work if DocumentEditor is rendered via <Outlet />
    const outletContext = useOutletContext<DocumentEditorLocalOutletContext>();
    contextSetAiReview = outletContext.setAiReview;
    contextSetIsAiReviewLoading = outletContext.setIsAiReviewLoading;
  } catch (e) {
    // Not rendered via Outlet, context will be undefined
  }

  // Prioritize props, then context
  const actualSetAiReview = propSetAiReview || contextSetAiReview;
  const actualSetIsAiReviewLoading = propSetIsAiReviewLoading || contextSetIsAiReviewLoading;

  useEffect(() => {
    if (actualSetAiReview) actualSetAiReview(aiReview);
  }, [aiReview, actualSetAiReview]);

  useEffect(() => {
    if (actualSetIsAiReviewLoading) actualSetIsAiReviewLoading(isLoadingAiReview);
  }, [isLoadingAiReview, actualSetIsAiReviewLoading]);

  const fetchDocumentAndReview = useCallback(async () => {
    if (!currentDocumentId) {
      setIsLoadingDocument(false);
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
      setStatus('draft');
      setAiReviewState(null);
      setViewingVersionContent(null);
      setViewingVersionNumber(null);
    } else {
      setDocument(data);
      setContent(data?.content || '');
      setStatus(data?.status || 'draft');
      setViewingVersionContent(null);
      setViewingVersionNumber(data?.current_version || null);

      const { data: reviewData, error: reviewError } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', currentDocumentId)
        .order('review_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reviewError && reviewError.code !== 'PGRST116') {
        console.error('Error fetching AI review:', reviewError);
        setAiReviewState(null);
      } else if (reviewData) {
        setAiReviewState(reviewData);
      } else {
        setAiReviewState(null);
      }
    }
    setIsLoadingDocument(false);
  }, [currentDocumentId]);

  useEffect(() => {
    fetchDocumentAndReview();
  }, [fetchDocumentAndReview]);

  const handleSave = async () => {
    if (!document || isSaving) return;

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

      showSuccess('Document saved and new version created successfully!');
      setDocument((prev) => prev ? { ...prev, content: content, current_version: newVersionNumber, status: status } : null);
      setViewingVersionContent(null);
      setViewingVersionNumber(newVersionNumber);
    } catch (error: any) {
      showError(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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
      navigate(`/dashboard/${currentProjectId}`); // Redirect to the project details page
    } catch (error: any) {
      showError(`Delete failed: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: Document['status']) => {
    if (!document || isSaving || !!viewingVersionContent) return;

    setStatus(newStatus);
    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', document.id);

    if (error) {
      showError(`Failed to update document status: ${error.message}`);
      setStatus(document.status);
    } else {
      showSuccess(`Document status updated to "${newStatus.replace('_', ' ')}".`);
      setDocument((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleGenerateAiReview = async () => {
    if (!document || isLoadingAiReview) return;

    setIsAiReviewState(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-review', {
        body: { documentId: document.id },
      });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess('AI review generated successfully!');
      await fetchDocumentAndReview();
    } catch (error: any) {
      showError(`AI review failed: ${error.message}`);
      setAiReviewState(null);
    } finally {
      setIsAiReviewState(false);
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
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
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

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">{document.document_name}</CardTitle>
            <CardDescription className="text-muted-foreground">
              Version: {viewingVersionNumber}
              {viewingVersionContent && <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Historical View)</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              onValueChange={(value: Document['status']) => handleStatusChange(value)}
              value={status}
              disabled={!!viewingVersionContent || isSaving}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            {viewingVersionContent && (
              <Button onClick={handleBackToLatest} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" /> Back to Latest
              </Button>
            )}
            <Button onClick={handleGenerateAiReview} disabled={isLoadingAiReview || !!viewingVersionContent}>
              {isLoadingAiReview ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Brain className="mr-2 h-4 w-4" /> Generate AI Review</>
              )}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !!viewingVersionContent}>
              {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Document</>}
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
                  <AlertDialogAction onClick={handleDeleteDocument} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
          <ReactQuill
            theme="snow"
            value={viewingVersionContent !== null ? viewingVersionContent : content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            readOnly={!!viewingVersionContent}
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