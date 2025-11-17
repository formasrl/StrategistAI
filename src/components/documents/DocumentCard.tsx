import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Document } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Hourglass, Edit, UploadCloud } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
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

const DocumentCard: React.FC<DocumentCardProps> = ({ document }) => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Link to={`/dashboard/${projectId}/document/${document.id}`}>
      <Card className="mb-2 hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> {document.document_name}
          </CardTitle>
          {getStatusBadge(document.status)}
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
          Version: {document.current_version}
        </CardContent>
      </Card>
    </Link>
  );
};

export default DocumentCard;