import React, { useState, useEffect, useCallback } from 'react';
import { Phase, Step } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import StepList from '@/components/steps/StepList';
import CreateStepDialog from '@/components/steps/CreateStepDialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface PhaseCardProps {
  phase: Phase;
  projectId: string;
  onPhaseUpdated: () => void; // Callback to notify parent (PhaseList) when phase data changes
}

const getStatusBadge = (status: Phase['status']) => {
  switch (status) {
    case 'complete':
      return <Badge className="bg-green-500 hover:bg-green-500/80 text-white">Complete</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/80 text-white">In Progress</Badge>;
    case 'not_started':
    case 'locked':
    default:
      return <Badge variant="outline" className="text-muted-foreground">{status.replace('_', ' ')}</Badge>;
  }
};

const PhaseCard: React.FC<PhaseCardProps> = ({ phase, projectId, onPhaseUpdated }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isCreateStepDialogOpen, setIsCreateStepDialogOpen] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase>(phase);

  const calculatePhaseProgress = useCallback(async () => {
    const { data: steps, error } = await supabase
      .from('steps')
      .select('status')
      .eq('phase_id', currentPhase.id);

    if (error) {
      showError(`Failed to calculate phase progress: ${error.message}`);
      return;
    }

    if (!steps || steps.length === 0) {
      setCurrentPhase((prev) => ({ ...prev, completion_percentage: 0, status: 'not_started' }));
      return;
    }

    const completedSteps = steps.filter((step) => step.status === 'complete').length;
    const inProgressSteps = steps.filter((step) => step.status === 'in_progress').length;
    const totalSteps = steps.length;

    const newCompletionPercentage = Math.round((completedSteps / totalSteps) * 100);

    let newStatus: Phase['status'] = 'not_started';
    if (newCompletionPercentage === 100) {
      newStatus = 'complete';
    } else if (inProgressSteps > 0 || completedSteps > 0) {
      newStatus = 'in_progress';
    }

    // Only update if there's a change to avoid unnecessary re-renders/updates
    if (newCompletionPercentage !== currentPhase.completion_percentage || newStatus !== currentPhase.status) {
      const { error: updateError } = await supabase
        .from('phases')
        .update({
          completion_percentage: newCompletionPercentage,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentPhase.id);

      if (updateError) {
        showError(`Failed to update phase progress: ${updateError.message}`);
      } else {
        setCurrentPhase((prev) => ({
          ...prev,
          completion_percentage: newCompletionPercentage,
          status: newStatus,
        }));
        onPhaseUpdated(); // Notify parent (PhaseList) that this phase has been updated
      }
    }
  }, [currentPhase, onPhaseUpdated]);

  useEffect(() => {
    // Recalculate progress when the phase prop changes (e.g., initial load or parent re-fetches)
    setCurrentPhase(phase);
    calculatePhaseProgress();
  }, [phase, calculatePhaseProgress]);

  const handleStepContentChange = () => {
    calculatePhaseProgress(); // Recalculate when a step is created or its status changes
  };

  return (
    <Card className="mb-4">
      <CardHeader className="p-4 pb-2">
        <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <span className="text-muted-foreground">{currentPhase.phase_number}.</span> {currentPhase.phase_name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(currentPhase.status)}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  <span className="sr-only">Toggle steps</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          {currentPhase.description && (
            <CardDescription className="mt-2 text-muted-foreground">
              {currentPhase.description}
            </CardDescription>
          )}
          <CardDescription className="mt-2">
            <Progress value={currentPhase.completion_percentage} className="h-2" />
            <span className="text-sm text-muted-foreground mt-1 block">
              {currentPhase.completion_percentage}% Complete
            </span>
          </CardDescription>
          <CollapsibleContent className="mt-4">
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold">Steps</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateStepDialogOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Step
                </Button>
              </div>
              <StepList phaseId={currentPhase.id} projectId={projectId} onStepStatusChange={handleStepContentChange} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
      <CreateStepDialog
        phaseId={currentPhase.id}
        isOpen={isCreateStepDialogOpen}
        onClose={() => setIsCreateStepDialogOpen(false)}
        onStepCreated={handleStepContentChange} // Recalculate when a new step is created
      />
    </Card>
  );
};

export default PhaseCard;