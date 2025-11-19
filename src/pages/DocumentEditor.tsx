import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentVersionList from '@/components/documents/DocumentVersionList';
import DocumentHeader from '@/components/documents/DocumentHeader';
import DocumentToolbar from '@/components/documents/DocumentToolbar';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useDocument } from '@/hooks/useDocument';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Loader2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentEditorProps {
  documentId: string;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId }) => {
  const { document, isLoadingDocument, content, setContent, saveDocument, isSaving, updateDocumentStatus, isUpdatingStatus, deleteDocument, isDeleting } = useDocument(documentId);

  const [viewingVersionContent, setViewingVersionContent] = useState<string | null>(null);
  const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

  const {
    isUploading,
    fileInputRef,
    handleFileChange,
    triggerFileUpload,
  } = useFileUpload(document?.id, (newContent) => {
    setContent(content + newContent);
  });

  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    if (document) {
      setContent(document.content || '');
      setViewingVersionNumber(document.current_version || null);
    }
  }, [document, setContent]);

  const isPublished = document?.status === 'published';
  const isHistoricalView = viewingVersionContent !== null;

  const versionLabel = useMemo(() => {
    const versionToDisplay = viewingVersionNumber ?? document?.current_version ?? '—';
    return `Version: ${versionToDisplay}`;
  }, [viewingVersionNumber, document?.current_version]);

  const handleSave = () => {
    saveDocument(content);
  };

  const handlePublish = () => {
    updateDocumentStatus('published');
  };

  const handleDisconnect = () => {
    updateDocumentStatus('draft');
  };

  const handleViewHistoricalVersion = (versionContent: string, versionNumber: number) => {
    setViewingVersionContent(versionContent);
    setViewingVersionNumber(versionNumber);
  };

  const handleBackToLatest = () => {
    setViewingVersionContent(null);
    setViewingVersionNumber(document?.current_version || null);
  };

  if (isLoadingDocument) {
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

  const disableSave = isSaving || isPublished || isHistoricalView || isUploading;
  const disablePublishDisconnect = isPublished ? isUpdatingStatus || isHistoricalView || isUploading : isUpdatingStatus || isSaving || isHistoricalView || isUploading;
  const disableDelete = isHistoricalView || isUploading || isDeleting;
  const showPublishedBanner = isPublished && !isHistoricalView;

  return (
    <div className="flex flex-col h-full space-y-4">
      <Card className="w-full flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between">
          <DocumentHeader
            title={document.document_name}
            versionLabel={versionLabel}
            isHistoricalView={isHistoricalView}
            isPublished={isPublished}
          />
          <div className="flex items-center gap-2">
            <Button
              id="tour-upload-document"
              onClick={triggerFileUpload}
              variant="outline"
              disabled={isPublished || isHistoricalView || isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Upload File
            </Button>
            <DocumentToolbar
              showBackButton={isHistoricalView}
              onBackToLatest={handleBackToLatest}
              isSaving={isSaving}
              onSave={handleSave}
              disableSave={disableSave}
              isPublished={isPublished}
              onPublish={handlePublish}
              onDisconnect={handleDisconnect}
              isPublishing={isUpdatingStatus && document.status === 'draft'}
              isDisconnecting={isUpdatingStatus && document.status === 'published'}
              disablePublishDisconnect={disablePublishDisconnect}
              onDelete={deleteDocument}
              isDeleting={isDeleting}
              disableDelete={disableDelete}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
          {showPublishedBanner && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              This document is published to RAG and locked for edits. Use “Disconnect” to make changes again.
            </div>
          )}
          {isUploading && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing file...
            </div>
          )}
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={isHistoricalView ? viewingVersionContent ?? '' : content}
            onChange={setContent}
            readOnly={isHistoricalView || isPublished || isUploading}
            placeholder="Start writing your document here..."
            className="flex-1 min-h-[300px] flex flex-col"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".docx,.html,.md"
          />
        </CardContent>
      </Card>

      {documentId && document.current_version !== undefined && (
        <DocumentVersionList
          documentId={documentId}
          currentVersionNumber={document.current_version}
          onViewVersion={handleViewHistoricalVersion}
        />
      )}
    </div>
  );
};

export default DocumentEditor;
