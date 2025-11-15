import React, { useState } from 'react';
import { Step } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CircleDot, Loader2, FileText, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import DocumentList from '@/components/documents/DocumentList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface StepCardProps {
  step: Step;
  projectId: string;
  onStatusChange: () => void; // Callback to notify parent of status change
}

const getStatusBadge = (status: Step['status']) => {
  switch (status) {
    case 'complete': // Changed from 'completed' to 'complete' to match type
      return <Badge className="bg-green-500 hover:bg-green-500/80 text-white"><CheckCircle2 className="mr-1 h-3 w-3" /> Complete</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/80 text-white"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> In Progress</Badge>;
    case 'not_started':
    default:
      return <Badge variant="outline" className="text-muted-foreground"><CircleDot className="mr-1 h-3 w-3" /> Not Started</Badge>;
  }
};

const StepCard: React.FC<StepCardProps> = ({ step, projectId, onStatusChange }) => {
  const [currentStatus, setCurrentStatus] = useState<Step['status']>(step.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: Step['status']) => {
    if (isUpdatingStatus || newStatus === currentStatus) return;

    setIsUpdatingStatus(true);
    const originalStatus = currentStatus;
    setCurrentStatus(newStatus); // Optimistic update

    const { error } = await supabase
      .from('steps')
      .update({ status: newStatus, created_at: new Date().toISOString() }) // Using created_at as updated_at for simplicity
      .eq('id', step.id);

    if (error) {
      showError(`Failed to update step status: ${error.message}`);
      setCurrentStatus(originalStatus); // Revert on error
    } else {
      showSuccess(`Step status updated to "${newStatus.replace('_', ' ')}".`);
      onStatusChange(); // Notify parent to re-fetch phases/steps
    }
    setIsUpdatingStatus(false);
  };

  return (
    <Card className="mb-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">{step.step_number}.</span> {step.step_name}
        </CardTitle>
        <Select
          onValueChange={handleStatusChange}
          value={currentStatus}
          disabled={isUpdatingStatus}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Select Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
        {step.description && <CardDescription className="mb-2">{step.description}</CardDescription>}
        {step.why_matters && (
          <div className="mt-2">
            <p className="font-medium">Why it matters:</p>
            <p>{step.why_matters}</p>
          </div>
        )}
        {step.dependencies && step.dependencies.length > 0 && (
          <div className="mt-2">
            <p className="font-medium">Dependencies:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {step.dependencies.map((dep, index) => (
                <Badge key={index} variant="outline">{dep}</Badge>
              ))}
            </div>
          </div>
        )}
        {step.timeline && (
          <div className="mt-2 flex items-center text-xs text-muted-foreground">
            <CalendarDays className="mr-1 h-3 w-3" />
            <span>Timeline: {step.timeline}</span>
          </div>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <h5 className="text-base font-semibold mb-2 flex items-center gap-1">
            <FileText className="h-4 w-4" /> Documents
          </h5>
          <DocumentList projectId={projectId} stepId={step.id} />
        </div>
      </CardContent>
    </Card>
  );
};

export default StepCard;