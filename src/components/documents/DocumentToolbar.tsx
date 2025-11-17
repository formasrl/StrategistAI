import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  RotateCcw,
  Save,
  UploadCloud,
  Link2Off,
  Trash2,
} from 'lucide-react';

interface DocumentToolbarProps {
  showBackButton: boolean;
  onBackToLatest: () => void;
  isSaving: boolean;
  onSave: () => void;
  disableSave: boolean;
  isPublished: boolean;
  onPublish: () => void;
  onDisconnect: () => void;
  isPublishing: boolean;
  isDisconnecting: boolean;
  disablePublishDisconnect: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  disableDelete: boolean;
}

const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  showBackButton,
  onBackToLatest,
  isSaving,
  onSave,
  disableSave,
  isPublished,
  onPublish,
  onDisconnect,
  isPublishing,
  isDisconnecting,
  disablePublishDisconnect,
  onDelete,
  isDeleting,
  disableDelete,
}) => {
  const renderPrimaryAction = () => {
    if (isPublished) {
      if (isDisconnecting) {
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disconnecting...
          </>
        );
      }
      return (
        <>
          <Link2Off className="mr-2 h-4 w-4" /> Disconnect
        </>
      );
    }

    if (isPublishing) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...
        </>
      );
    }

    return (
      <>
        <UploadCloud className="mr-2 h-4 w-4" /> Publish
      </>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showBackButton && (
        <Button onClick={onBackToLatest} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> Back to Latest
        </Button>
      )}

      <Button onClick={onSave} disabled={disableSave}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> Save
          </>
        )}
      </Button>

      <Button
        onClick={isPublished ? onDisconnect : onPublish}
        variant={isPublished ? 'outline' : 'secondary'}
        disabled={disablePublishDisconnect}
      >
        {renderPrimaryAction()}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="icon" disabled={disableDelete}>
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Delete Document</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this document
              and all its associated versions and AI reviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentToolbar;