"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, History, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast'; // Using consistent toast functions
import { AiReview } from '@/types/supabase';
import ReviewDialog from './ReviewDialog'; // New import
import { formatDateTime } from '@/utils/dateUtils'; // New import

interface AiPanelContentProps {
  documentId?: string;
  projectId?: string;
}

const AiPanelContent: React.FC<AiPanelContentProps> = ({ documentId, projectId }) => {
  const [reviews, setReviews] = useState<AiReview[]>([]); // Store all reviews
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false); // Separate state for generation
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AiReview | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!documentId) {
      setReviews([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', documentId)
        .order('review_timestamp', { ascending: false }); // Order by latest first

      if (error) throw error;
      setReviews(data || []);
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      showError(`Failed to load reviews: ${error.message}`);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleGenerateReview = async () => {
    if (!documentId) return;
    setIsGeneratingReview(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-review', {
        body: { documentId, projectId }
      });

      if (error) throw error;
      
      const newReview = data.review as AiReview; // The edge function now returns the full new review
      setReviews(prev => [newReview, ...prev]); // Add new review to the top of the list
      setSelectedReview(newReview); // Select the new review to open in dialog
      setIsReviewDialogOpen(true); // Open the dialog
      showSuccess("AI has analyzed your document.");
    } catch (error: any) {
      console.error('Error generating review:', error);
      showError(`Failed to generate review: ${error.message}`);
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const handleOpenReview = (review: AiReview) => {
    setSelectedReview(review);
    setIsReviewDialogOpen(true);
  };

  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>Select a document to generate an AI review.</p>
      </div>
    );
  }

  const latestReview = reviews[0]; // The most recent review

  return (
    <div className="space-y-6 p-4 pb-8">
      <div className="flex items-center justify-between" id="tour-generate-review">
        <h3 className="font-semibold text-lg">AI Review</h3>
        <Button 
          onClick={handleGenerateReview} 
          disabled={isGeneratingReview} 
          size="sm"
          variant={latestReview ? "outline" : "default"}
        >
          {isGeneratingReview ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {latestReview ? 'Re-evaluate' : 'Generate Review'}
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
          <div className="h-16 w-full bg-muted animate-pulse rounded-md"></div>
        </div>
      ) : (
        <>
          {latestReview ? (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  Latest Review
                  <Badge 
                    variant={
                      latestReview.readiness === 'ready' ? 'default' : 
                      latestReview.readiness === 'not_ready' ? 'secondary' : 'outline'
                    }
                    className={latestReview.readiness === 'ready' ? 'bg-green-600' : ''}
                  >
                    {latestReview.readiness?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {latestReview.summary}
                </p>
                <Button variant="link" className="p-0 h-auto text-sm" onClick={() => handleOpenReview(latestReview)}>
                  View Full Review
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No review generated yet.</p>
              <p className="text-sm">Click "Generate Review" to analyze this document.</p>
            </div>
          )}

          {reviews.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Review History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {reviews.slice(1).map((reviewItem) => ( // Exclude the latest review
                      <div key={reviewItem.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatDateTime(reviewItem.review_timestamp, 'MMM d, yyyy HH:mm')}
                        </span>
                        <Button variant="link" className="p-0 h-auto text-sm" onClick={() => handleOpenReview(reviewItem)}>
                          View Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedReview && (
        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          review={selectedReview}
        />
      )}
    </div>
  );
};

export default AiPanelContent;