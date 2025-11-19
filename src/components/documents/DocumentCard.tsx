import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Document, DocumentWithEmbedding } from '@/types/supabase'; // Import DocumentWithEmbedding
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Hourglass, Edit, UploadCloud, Brain, Loader2 } from 'lucide-react';

interface DocumentCardProps {
  document: DocumentWithEmbedding; // Use the new type
}

const getStatusBadge = (status: Document['status']) => {
  switch (status) {
    case 'published':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-500/80 text-white">
          <UploadCloud className="mr-1 h-3 w-3" /> Published
        </Badge>
      );
    case 'approved':
      return (
        <Badge className="bg-green-500 hover:bg-green-500/80 text-white">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
        </Badge>
      );
    case 'in_review':
      return (
        <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/80 text-white">
          <Hourglass className="mr-1 h-3 w-3 animate-pulse" /> In Review
        </Badge>
      );
    case 'draft':
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Edit className="mr-1 h-3 w-3" /> Draft
        </Badge>
      );
  }
};

const getIndexingStatusBadge = (document: DocumentWithEmbedding) => {
  const hasSummary = document.summary && document.summary.trim().length > 0;
  const hasKeyDecisions = document.key_decisions && document.key_decisions.length > 0;
  const hasEmbedding = document.step_embeddings && document.step_embeddings.length > 0;

  if (hasSummary && hasKeyDecisions && hasEmbedding) {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        <Brain className="mr-1 h-3 w-3" /> Ready for AI
      </Badge>
    );
  }

  // If document is published/approved but not fully indexed, show "Indexing..."
  if ((document.status === 'published' || document.status === 'approved') && (!hasSummary || !hasKeyDecisions || !hasEmbedding)) {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Indexing...
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      Not Indexed
    </Badge>
  );
};

const DocumentCard: React.FC<DocumentCardProps> = ({ document }) => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Link to={`/dashboard/${projectId}/document/${document.id}`}>
      <Card className="mb-2 hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> {document.document_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(document.status)}
            {getIndexingStatusBadge(document)}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
          Version: {document.current_version}
        </CardContent>
      </Card>
    </Link>
  );
};

export default DocumentCard;