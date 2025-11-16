import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Step } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CircleDot, CircleDashed } from 'lucide-react';

interface StepListProps {
  phaseId: string;
  projectId: string; // Passed for potential future routing or context
  onStepStatusChange: () => void; // Callback for when a step's status changes (e.g., to update phase progress)
}

const getStatusIcon = (status: Step['status']) => {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'in_progress':
      return <CircleDot className="h-4 w-4 text-blue-500" />;
    case 'not_started':
    case 'locked':
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadgeVariant = (status: Step['status']) => {
  switch (status) {
    case 'complete':
      return 'default'; // Green by default
    case 'in_progress':
      return 'secondary'; // Blue by default
    case 'not_started':
    case 'locked':
    default:
      return 'outline'; // Grey by default
  }
};

const StepList: React.FC<StepListProps> = ({ phaseId, projectId, onStepStatusChange }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSteps = async () => {
      setIsLoading(true);
      console.log(`[StepList] Fetching steps for phaseId: ${phaseId}`);
      const { data, error } = await supabase
        .from('steps')
        .select('*')
        .eq('phase_id', phaseId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error(`[StepList] Failed to load steps for phaseId ${phaseId}:`, error);
        showError(`Failed to load steps: ${error.message}`);
        setSteps([]);
      } else {
        console.log(`[StepList] Steps loaded for phaseId ${phaseId}:`, data);
        setSteps(data || []);
      }
      setIsLoading(false);
    };

    if (phaseId) {
      fetchSteps();
    }

    // Set up real-time subscription for steps in this phase
    const channel = supabase
      .channel(`steps_for_phase_${phaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'steps',
          filter: `phase_id=eq.${phaseId}`,
        },
        (payload) => {
          console.log(`[StepList] Realtime update for phaseId ${phaseId}:`, payload);
          fetchSteps();
          onStepStatusChange(); // Notify parent (PhaseCard) to recalculate progress
        }
      )
      .subscribe();

    return () => {
      console.log(`[StepList] Unsubscribing from channel steps_for_phase_${phaseId}`);
      supabase.removeChannel(channel);
    };
  }, [phaseId, onStepStatusChange]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (steps.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No steps defined for this phase yet.</p>;
  }

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <Card key={step.id} className="border-l-4 border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon(step.status)}
                {step.step_number}. {step.step_name}
              </CardTitle>
              <Badge variant={getStatusBadgeVariant(step.status)}>
                {step.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          {step.description && (
            <CardContent className="text-sm text-muted-foreground pt-0">
              {step.description}
            </CardContent>
          )}
          {/* Future: Add buttons to interact with step, e.g., mark complete, view guide */}
        </Card>
      ))}
    </div>
  );
};

export default StepList;