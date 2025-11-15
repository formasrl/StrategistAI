import React from 'react';
import { AiReview } from '@/types/supabase';
import AiReviewDisplay from './AiReviewDisplay';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AiPanelContentProps {
  documentId?: string;
  aiReview: AiReview | null;
  isAiReviewLoading: boolean;
  onGenerateReview: (docId: string) => void;
}

const AiPanelContent: React.FC<AiPanelContentProps> = ({
  documentId,
  aiReview,
  isAiReviewLoading,
  onGenerateReview,
}) => {
  if (!documentId) {
    return (
      <Card className="p-4 text-center text-muted-foreground">
        <FileText className="mx-auto h-10 w-10 mb-3 text-gray-400" />
        <p className="text-lg font-semibold">No Document Selected</p>
        <p className="text-sm">Select a document from the roadmap to view or generate AI reviews.</p>
      </Card>
    );
  }

  if (isAiReviewLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (!aiReview) {
    return (
      <Card className="p-4 text-center space-y-4">
        <Brain className="mx-auto h-10 w-10 mb-3 text-blue-500" />
        <p className="text-lg font-semibold">No AI Review Available</p>
        <p className="text-sm text-muted-foreground">
          Generate an AI-powered review to get insights and suggestions for your document.
        </p>
        <Button onClick={() => onGenerateReview(documentId)} disabled={isAiReviewLoading} className="w-full">
          <Brain className="mr-2 h-4 w-4" /> Generate AI Review
        </Button>
      </Card>
    );
  }

  return <AiReviewDisplay review={aiReview} isLoading={isAiReviewLoading} />;
};

export default AiPanelContent;