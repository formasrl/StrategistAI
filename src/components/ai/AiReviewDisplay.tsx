import React from 'react';
import { AiReview } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Lightbulb,
  AlertTriangle,
  GitCompare,
  MessageSquareText,
  ShieldCheck,
} from 'lucide-react';

interface AiReviewDisplayProps {
  review: AiReview | null;
  isLoading: boolean;
}

type ExtendedReview = AiReview & {
  summary?: string | null;
  issues?: unknown;
  consistency_issues?: unknown;
  readiness?: string | null;
  readiness_reason?: string | null;
};

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

  const extended = review as ExtendedReview;

  const summary = typeof extended.summary === 'string' && extended.summary.trim() ? extended.summary.trim() : null;
  const strengths = sanitizeStringArray(review.strengths, 7);
  const issues = sanitizeStringArray(extended.issues, 7);
  const consistencyIssues =
    sanitizeStringArray(extended.consistency_issues, 6) || sanitizeStringArray(review.conflicts, 6);
  const suggestions = sanitizeStringArray(review.suggestions, 7);
  const readiness = typeof extended.readiness === 'string' ? extended.readiness.toLowerCase() : null;
  const readinessReason =
    typeof extended.readiness_reason === 'string' && extended.readiness_reason.trim()
      ? extended.readiness_reason.trim()
      : null;

  return (
    <div className="space-y-4">
      {summary && (
        <Card>
          <CardHeader className="flex items-center gap-2 p-4 pb-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm text-muted-foreground">{summary}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex items-center gap-2 p-4 pb-2">
          <Lightbulb className="h-5 w-5 text-green-500" />
          <CardTitle className="text-lg">Strengths</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {renderList(strengths, 'No strengths identified yet.')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2 p-4 pb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg">Issues</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {renderList(issues, 'No gaps detected.')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2 p-4 pb-2">
          <GitCompare className="h-5 w-5 text-sky-500" />
          <CardTitle className="text-lg">Consistency Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {renderList(consistencyIssues, 'No conflicts with previous decisions.')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2 p-4 pb-2">
          <MessageSquareText className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-lg">Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {renderList(suggestions, 'No specific improvements suggested.')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2 p-4 pb-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-lg">Readiness</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Status:</span>
            <span
              className={
                readiness === 'ready'
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-amber-600 dark:text-amber-400 font-medium'
              }
            >
              {readiness === 'ready' ? 'Ready for next step' : 'Needs more work'}
            </span>
          </div>
          {readinessReason && (
            <>
              <Separator className="my-2" />
              <p className="text-sm italic">Reason: {readinessReason}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function renderList(items: string[], emptyState: string) {
  if (!items.length) {
    return <p className="italic">{emptyState}</p>;
  }

  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function sanitizeStringArray(value: unknown, maxItems: number): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const title = typeof record.title === 'string' ? record.title.trim() : '';
          const detail =
            typeof record.detail === 'string'
              ? record.detail.trim()
              : typeof record.description === 'string'
                ? record.description.trim()
                : '';
          const combined = [title, detail].filter(Boolean).join(': ');
          if (combined) {
            return combined;
          }
        }
        return '';
      })
      .filter((item) => item.length > 0)
      .slice(0, maxItems);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export default AiReviewDisplay;