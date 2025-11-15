import React from 'react';
import { AiReview } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, MessageSquareText, AlertTriangle, Sparkles } from 'lucide-react';

interface AiReviewDisplayProps {
  review: AiReview | null;
  isLoading: boolean;
}

const AiReviewDisplay: React.FC<AiReviewDisplayProps> = ({ review, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
        <div className="h-24 w-full bg-muted animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (!review) {
    return (
      <p className="text-muted-foreground text-sm italic text-center">
        No AI review available for this document. Click "Generate AI Review" to get started!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <Lightbulb className="h-5 w-5 text-green-500" />
          <CardTitle className="text-lg">Strengths</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {review.strengths && review.strengths.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {review.strengths.map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          ) : (
            'No strengths identified.'
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <MessageSquareText className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {review.suggestions && review.suggestions.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2">
              {review.suggestions.map((suggestion, index) => (
                <li key={index}>
                  <p className="font-medium text-foreground">{suggestion.title}</p>
                  <p>{suggestion.description}</p>
                  {suggestion.example && <p className="italic text-xs">Example: {suggestion.example}</p>}
                </li>
              ))}
            </ul>
          ) : (
            'No suggestions provided.'
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg">Conflicts</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {review.conflicts && review.conflicts.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2">
              {review.conflicts.map((conflict, index) => (
                <li key={index}>
                  <p className="font-medium text-foreground">Issue: {conflict.issue}</p>
                  {conflict.resolution && <p>Resolution: {conflict.resolution}</p>}
                </li>
              ))}
            </ul>
          ) : (
            'No conflicts detected.'
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center space-x-2 p-4 pb-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-lg">Alternatives</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {review.alternatives && review.alternatives.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {review.alternatives.map((alternative, index) => (
                <li key={index}>{alternative}</li>
              ))}
            </ul>
          ) : (
            'No alternatives suggested.'
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AiReviewDisplay;