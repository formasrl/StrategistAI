import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Document, AiReview } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Brain, Loader2, History, RotateCcw } from 'lucide-react';
import AiReviewDisplay from '@/components/ai/AiReviewDisplay';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // New import

interface DocumentEditorOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
}

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<Document['status']>('draft'); // State for document status
  const [isSaving, setIsSaving] = useState(false);
  const [aiReview, setAiReviewState] = useState<AiReview | null>(null);
  const [isLoadingAiReview, setIsLoadingAiReviewState] = useState(false);
  const { setAiReview, setIsAiReviewLoading } = useOutletContext<DocumentEditorOutletContext>();

  // State for viewing historical versions
  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  // Sync AI review state with DashboardLayout context
  useEffect(() => {
    setAiReview(aiReview);
  }, [aiReview, setAiReview]);

  useEffect(() => {
    setIsAiReviewLoading(isLoadingAiReview);
  }, [isLoadingAiReview, setIsAiReviewLoading]);

  const fetchDocumentAndReview = useCallback(async () => {
    if (!documentId) {
      setIsLoadingDocument(false);
      return;
    }

    setIsLoadingDocument(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
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
      setStatus(data?.status || 'draft'); // Set initial status
      setViewingVersionContent(null); // Reset viewing historical content
      setViewingVersionNumber(data?.current_version || null);

      // Fetch latest AI review for this document
      const { data: reviewData, error: reviewError } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', documentId)
        .order('review_timestamp', { ascending: false }) // Use review_timestamp
        .limit(1)
        .maybeSingle();

      if (reviewError && reviewError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching AI review:', reviewError);
        setAiReviewState(null);
      } else if (reviewData) {
        setAiReviewState(reviewData);
      } else {
        setAiReviewState(null);
      }
    }
    setIsLoadingDocument(false);
  }, [documentId]);

  useEffect(() => {
    fetchDocumentAndReview();
  }, [fetchDocumentAndReview]);

  const handleSave = async () => {
    if (!document || isSaving) return;

    setIsSaving(true);
    try {
      const newVersionNumber = (document.current_version || 0) + 1;

      // 1. Insert new version into document_versions
      const { error: versionError } = await supabase.from('document_versions').insert({
        document_id: document.id,
        content: content,
        version: newVersionNumber,
        change_description: `Saved version ${newVersionNumber}`, // Can be enhanced with user input
      });

      if (versionError) {
        throw new Error(`Failed to create document version: ${versionError.message}`);
      }

      // 2. Update the main document with the new content, version, and status
      const { error: documentUpdateError } = await supabase
        .from('documents')
        .update({
          content: content,
          current_version: newVersionNumber,
          status: status, // Update status here
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);

      if (documentUpdateError) {
        throw new Error(`Failed to update document: ${documentUpdateError.message}`);
      }

      showSuccess('Document saved and new version created successfully!');
      setDocument((prev) => prev ? { ...prev, content: content, current_version: newVersionNumber, status: status } : null);
      setViewingVersionContent(null); // Ensure we're viewing the latest after save
      setViewingVersionNumber(newVersionNumber);
    } catch (error: any) {
      showError(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: Document['status']) => {
    if (!document || isSaving || !!viewingVersionContent) return; // Prevent status change when viewing historical or saving

    setStatus(newStatus); // Optimistic update
    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', document.id);

    if (error) {
      showError(`Failed to update document status: ${error.message}`);
      // Revert status on error
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
      // Refetch the latest review from the database to ensure consistency
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
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
          <Textarea
            value={viewingVersionContent !== null ? viewingVersionContent : content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing your document here..."
            className="flex-1 min-h-[300px] resize-none"
            readOnly={!!viewingVersionContent} // Make read-only if viewing historical version
          />
        </CardContent>
      </Card>

      {document.id && document.current_version !== undefined && (
        <DocumentVersionList
          documentId={document.id}
          currentVersionNumber={document.current_version}
          onViewVersion={handleViewHistoricalVersion}
        />
      )}
    </div>
  );
};

export default DocumentEditor;