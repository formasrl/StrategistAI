import React, { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Document, AiReview } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Brain, Loader2 } from 'lucide-react';
import AiReviewDisplay from '@/components/ai/AiReviewDisplay'; // New import

interface DocumentEditorOutletContext {
  setAiReview: (review: AiReview | null) => void;
  setIsAiReviewLoading: (isLoading: boolean) => void;
}

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [aiReview, setAiReviewState] = useState<AiReview | null>(null);
  const [isLoadingAiReview, setIsLoadingAiReviewState] = useState(false);
  const { setAiReview, setIsAiReviewLoading } = useOutletContext<DocumentEditorOutletContext>();

  // Sync AI review state with DashboardLayout context
  useEffect(() => {
    setAiReview(aiReview);
  }, [aiReview, setAiReview]);

  useEffect(() => {
    setIsAiReviewLoading(isLoadingAiReview);
  }, [isLoadingAiReview, setIsAiReviewLoading]);


  const fetchDocumentAndReview = async () => {
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
      setAiReviewState(null);
    } else {
      setDocument(data);
      setContent(data?.content || '');
      // Fetch latest AI review for this document
      const { data: reviewData, error: reviewError } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

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
  };

  useEffect(() => {
    fetchDocumentAndReview();
  }, [documentId]);

  const handleSave = async () => {
    if (!document || isSaving) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('documents')
      .update({ content: content, updated_at: new Date().toISOString() })
      .eq('id', document.id);

    if (error) {
      showError(`Failed to save document: ${error.message}`);
    } else {
      showSuccess('Document saved successfully!');
      setDocument((prev) => prev ? { ...prev, content: content } : null);
    }
    setIsSaving(false);
  };

  const handleGenerateAiReview = async () => {
    if (!document || isLoadingAiReview) return;

    setIsAiReviewState(true);
    const { data, error } = await supabase.functions.invoke('generate-ai-review', {
      body: { documentId: document.id },
    });

    if (error) {
      showError(`AI review failed: ${error.message}`);
      setAiReviewState(null);
    } else {
      showSuccess('AI review generated successfully!');
      // Refetch the latest review from the database to ensure consistency
      await fetchDocumentAndReview();
    }
    setIsAiReviewState(false);
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
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-bold">{document.document_name}</CardTitle>
          <CardDescription className="text-muted-foreground">
            Status: {document.status} | Version: {document.current_version}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateAiReview} disabled={isLoadingAiReview}>
            {isLoadingAiReview ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Brain className="mr-2 h-4 w-4" /> Generate AI Review</>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Document</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6 pt-0">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your document here..."
          className="flex-1 min-h-[300px] resize-none"
        />
      </CardContent>
    </Card>
  );
};

export default DocumentEditor;