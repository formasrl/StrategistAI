"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AiReview } from '@/types/supabase';

interface AiPanelContentProps {
  documentId?: string;
  projectId?: string;
}

const AiPanelContent: React.FC<AiPanelContentProps> = ({ documentId, projectId }) => {
  const [review, setReview] = useState<AiReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchReview = async () => {
    if (!documentId) return;
    try {
      const { data, error } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', documentId)
        .maybeSingle();

      if (error) throw error;
      if (data) setReview(data as AiReview);
      else setReview(null);
    } catch (error) {
      console.error('Error fetching review:', error);
    }
  };

  useEffect(() => {
    fetchReview();
  }, [documentId]);

  const handleGenerateReview = async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-review', {
        body: { documentId, projectId }
      });

      if (error) throw error;
      
      setReview(data);
      toast({
        title: "Review Generated",
        description: "AI has analyzed your document.",
      });
    } catch (error) {
      console.error('Error generating review:', error);
      toast({
        title: "Error",
        description: "Failed to generate review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!documentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Select a document to generate an AI review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-8">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">AI Review</h3>
        <Button 
          onClick={handleGenerateReview} 
          disabled={isLoading} 
          size="sm"
          variant={review ? "outline" : "default"}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              {review ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {review ? 'Re-evaluate' : 'Generate Review'}
            </>
          )}
        </Button>
      </div>

      {review ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Readiness Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Status
                <Badge 
                  variant={
                    review.readiness === 'ready' ? 'default' : 
                    review.readiness === 'review_needed' ? 'secondary' : 'outline'
                  }
                  className={review.readiness === 'ready' ? 'bg-green-600' : ''}
                >
                  {review.readiness?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{review.readiness_reason}</p>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Summary
            </h4>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              {review.summary}
            </p>
          </div>

          {/* Strengths */}
          {review.strengths && (review.strengths as string[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Strengths
              </h4>
              <ul className="space-y-1">
                {(review.strengths as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6 relative before:absolute before:left-2 before:top-2 before:w-1 before:h-1 before:bg-green-500 before:rounded-full">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {review.suggestions && (review.suggestions as string[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Suggestions
              </h4>
              <ul className="space-y-1">
                {(review.suggestions as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6 relative before:absolute before:left-2 before:top-2 before:w-1 before:h-1 before:bg-blue-500 before:rounded-full">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issues */}
          {review.issues && (review.issues as string[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Issues
              </h4>
              <ul className="space-y-1">
                {(review.issues as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6 relative before:absolute before:left-2 before:top-2 before:w-1 before:h-1 before:bg-red-500 before:rounded-full">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Consistency */}
          {review.consistency_issues && (review.consistency_issues as string[]).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Consistency
              </h4>
              <ul className="space-y-1">
                {(review.consistency_issues as string[]).map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6 relative before:absolute before:left-2 before:top-2 before:w-1 before:h-1 before:bg-amber-500 before:rounded-full">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No review generated yet.</p>
          <p className="text-sm">Click generate to analyze this document.</p>
        </div>
      )}
    </div>
  );
};

function Brain(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

export default AiPanelContent;