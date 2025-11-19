import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, CircleDashed, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SuggestedStep {
  step_id: string;
  step_name: string;
  description: string | null;
  score: number;
}

interface StepSuggestionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SuggestedStep[];
  onSelectStep: (stepId: string) => void;
  currentStepId: string;
  isLoading: boolean;
}

const StepSuggestionDialog: React.FC<StepSuggestionDialogProps> = ({
  isOpen,
  onClose,
  suggestions,
  onSelectStep,
  currentStepId,
  isLoading,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" /> AI Step Suggestion
          </DialogTitle>
          <DialogDescription>
            Based on your uploaded document, here are some steps it might be related to.
            You can re-assign this document to a different step if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              <p>Generating suggestions...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-center text-muted-foreground italic">No relevant steps found.</p>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.step_id}
                    className={cn(
                      "flex flex-col p-3 border rounded-md cursor-pointer transition-colors",
                      suggestion.step_id === currentStepId
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-500"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onSelectStep(suggestion.step_id)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-base">
                        {suggestion.step_name}
                      </h4>
                      {suggestion.step_id === currentStepId ? (
                        <Badge className="bg-blue-500 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" /> Current
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Score: {suggestion.score.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    {suggestion.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.description}
                      </p>
                    )}
                    {suggestion.step_id !== currentStepId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2 self-end"
                        onClick={() => onSelectStep(suggestion.step_id)}
                      >
                        Select This Step
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StepSuggestionDialog;