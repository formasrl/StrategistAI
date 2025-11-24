import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AiReviewDisplay from './AiReviewDisplay';
import { AiReview } from '@/types/supabase';
import { Sparkles } from 'lucide-react';
import { formatDateTime } from '@/utils/dateUtils';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  review: AiReview | null;
}

const ReviewDialog: React.FC<ReviewDialogProps> = ({ isOpen, onClose, review }) => {
  if (!review) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-purple-500" /> AI Document Review
          </DialogTitle>
          <DialogDescription>
            Review generated on {formatDateTime(review.review_timestamp, 'MMM d, yyyy HH:mm')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-4 -mr-4"> {/* Added negative margin to counteract scrollbar padding */}
          <AiReviewDisplay review={review} isLoading={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDialog;