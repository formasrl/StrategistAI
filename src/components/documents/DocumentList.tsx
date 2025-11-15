import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '@/types/supabase';
import { showError } from '@/utils/toast';
import DocumentCard from './DocumentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import CreateDocumentDialog from './CreateDocumentDialog';

interface DocumentListProps {
  projectId: string;
  stepId: string;
}

const DocumentList: React.FC<DocumentListProps> = ({ projectId, stepId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDocumentDialogOpen, setIsCreateDocumentDialogOpen] = useState(false);

  const fetchDocuments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('step_id', stepId)
      .order('created_at', { ascending: true });

    if (error) {
      showError(`Failed to load documents: ${error.message}`);
      setDocuments([]);
    } else {
      setDocuments(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [stepId]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreateDocumentDialogOpen(true)}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Document
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-sm italic text-center">No documents for this step.</p>
      ) : (
        documents.map((document) => (
          <DocumentCard key={document.id} document={document} />
        ))
      )}
      <CreateDocumentDialog
        projectId={projectId}
        stepId={stepId}
        isOpen={isCreateDocumentDialogOpen}
        onClose={() => setIsCreateDocumentDialogOpen(false)}
        onDocumentCreated={fetchDocuments}
      />
    </div>
  );
};

export default DocumentList;