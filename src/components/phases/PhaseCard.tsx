import React, { useState, useEffect, useCallback } from 'react';
import { Phase } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import StepList from '@/components/steps/StepList';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface PhaseCardProps {
  phase: Phase;
  projectId: string;
  onPhaseUpdated: () => void;
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
  const [isOpen, setIsOpen] = useState(false);
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

    if (newCompletionPercentage !== currentPhase.completion_percentage || newStatus !== currentPhase.status) {
      const { error: updateError } = await supabase
        .from('phases')
        .update({
          completion_percentage: newCompletionPercentage,
          status: newStatus,
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
        onPhaseUpdated();
      }
    }
  }, [currentPhase, onPhaseUpdated]);

  useEffect(() => {
    setCurrentPhase(phase);
  }, [phase]);

  useEffect(() => {
    calculatePhaseProgress();
  }, [calculatePhaseProgress]);

  const handleStepContentChange = () => {
    calculatePhaseProgress();
  };

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4 pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <span className="text-muted-foreground">{currentPhase.phase_number}.</span> {currentPhase.phase_name}
              </CardTitle>
              <div className="flex items-center gap-2">
                {getStatusBadge(currentPhase.status)}
                <Button variant="ghost" size="sm" className="p-2">
                  {/* Wrap children in a span to ensure a single React element child */}
                  <span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                    ) : (
                      <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
                    )}
                    <span className="sr-only">Toggle steps</span>
                  </span>
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>
          {currentPhase.description && (
            <CardDescription className="mt-2 text-muted-foreground">
              {currentPhase.description}
            </CardDescription>
          )}
          {/* Moved Progress out of CardDescription to fix HTML nesting warning */}
          <div className="mt-2">
            <Progress value={currentPhase.completion_percentage} className="h-2" />
            <span className="text-sm text-muted-foreground mt-1 block">
              {currentPhase.completion_percentage}% Complete
            </span>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t border-border pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold">Steps</h4>
            </div>
            <StepList phaseId={currentPhase.id} projectId={projectId} onStepStatusChange={handleStepContentChange} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default PhaseCard;