import React from 'react';
import { CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DocumentHeaderProps {
  title: string;
  versionLabel: string;
  isHistoricalView: boolean;
  isPublished: boolean;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  versionLabel,
  isHistoricalView,
  isPublished,
}) => {
  return (
    <div>
      <CardTitle className="text-2xl font-bold">{title}</CardTitle>
      <CardDescription className="text-muted-foreground">
        {versionLabel}
        {isHistoricalView && (
          <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Historical View)</span>
        )}
      </CardDescription>
      <div className="mt-2 flex items-center gap-2">
        <Badge
          variant={isPublished ? 'secondary' : 'outline'}
          className={isPublished ? 'bg-emerald-500 text-white hover:bg-emerald-500/80' : ''}
        >
          {isPublished ? 'Published to RAG (read-only)' : 'Editable'}
        </Badge>
        {!isPublished && (
          <span className="text-xs text-muted-foreground">
            Use Publish to surface in RAG.
          </span>
        )}
      </div>
    </div>
  );
};

export default DocumentHeader;