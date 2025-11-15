import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Document } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

const DocumentEditor: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        showError(`Failed to load document: ${error.message}`);
        setDocument(null);
        setContent('');
      } else {
        setDocument(data);
        setContent(data?.content || '');
      }
      setIsLoading(false);
    };

    fetchDocument();
  }, [documentId]);

  const handleSave = async () => {
    if (!document || isSaving) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('documents')
      .update({ content: content, updated_at: new Date().toISOString() }) // Assuming updated_at exists
      .eq('id', document.id);

    if (error) {
      showError(`Failed to save document: ${error.message}`);
    } else {
      showSuccess('Document saved successfully!');
      // Optionally, update the document state to reflect the saved content
      setDocument((prev) => prev ? { ...prev, content: content } : null);
    }
    setIsSaving(false);
  };

  if (isLoading) {
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
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Document</>}
        </Button>
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