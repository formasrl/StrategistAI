import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Phase } from '@/types/supabase';
import { showError } from '@/utils/toast';
import PhaseCard from './PhaseCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import CreatePhaseDialog from './CreatePhaseDialog';

interface PhaseListProps {
  projectId: string;
}

const PhaseList: React.FC<PhaseListProps> = ({ projectId }) => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatePhaseDialogOpen, setIsCreatePhaseDialogOpen] = useState(false);

  const fetchPhases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('phase_number', { ascending: true });

    if (error) {
      showError(`Failed to load phases: ${error.message}`);
      setPhases([]);
    } else {
      setPhases(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPhases();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreatePhaseDialogOpen(true)} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Phase
        </Button>
      </div>
      {phases.length === 0 ? (
        <p className="text-muted-foreground text-center italic">No phases defined for this project. Click "Add New Phase" to get started!</p>
      ) : (
        phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} projectId={projectId} onStepCreated={fetchPhases} />
        ))
      )}
      <CreatePhaseDialog
        projectId={projectId}
        isOpen={isCreatePhaseDialogOpen}
        onClose={() => setIsCreatePhaseDialogOpen(false)}
        onPhaseCreated={fetchPhases}
      />
    </div>
  );
};

export default PhaseList;