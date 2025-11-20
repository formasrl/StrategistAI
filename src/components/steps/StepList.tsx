import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Step } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Skeleton } from '@/components/ui/skeleton';
import StepCard from './StepCard'; // Import StepCard

interface StepListProps {
  phaseId: string;
  projectId: string; // projectId is now explicitly used and passed down
  onStepStatusChange: () => void;
}

const StepList: React.FC<StepListProps> = ({ phaseId, projectId, onStepStatusChange }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSteps = async () => {
      setIsLoading(true);
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
        setSteps(data || []);
      }
      setIsLoading(false);
    };

    if (phaseId) {
      fetchSteps();
    }

    const channel = supabase
      .channel(`steps_for_phase_${phaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'steps',
          filter: `phase_id=eq.${phaseId}`,
        },
        () => {
          fetchSteps();
          onStepStatusChange();
        }
      )
      .subscribe();

    return () => {
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
        <StepCard
          key={step.id}
          step={step}
          projectId={projectId} // Pass projectId to StepCard
          onStepStatusChange={onStepStatusChange}
        />
      ))}
    </div>
  );
};

export default StepList;