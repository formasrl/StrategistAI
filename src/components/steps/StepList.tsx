import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Step } from '@/types/supabase';
import { showError } from '@/utils/toast';
import StepCard from './StepCard';
import { Skeleton } from '@/components/ui/skeleton';

interface StepListProps {
  phaseId: string;
  projectId: string; // Added projectId prop
}

const StepList: React.FC<StepListProps> = ({ phaseId, projectId }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSteps = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('steps')
      .select('*')
      .eq('phase_id', phaseId)
      .order('step_number', { ascending: true });

    if (error) {
      showError(`Failed to load steps: ${error.message}`);
      setSteps([]);
    } else {
      setSteps(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSteps();
  }, [phaseId]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (steps.length === 0) {
    return <p className="text-muted-foreground text-sm italic">No steps defined for this phase.</p>;
  }

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <StepCard key={step.id} step={step} projectId={projectId} />
      ))}
    </div>
  );
};

export default StepList;