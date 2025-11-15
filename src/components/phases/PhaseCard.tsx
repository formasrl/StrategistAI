import React, { useState } from 'react';
import { Phase } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import StepList from '@/components/steps/StepList';
import CreateStepDialog from '@/components/steps/CreateStepDialog';
import { Badge } from '@/components/ui/badge';

interface PhaseCardProps {
  phase: Phase;
  projectId: string; // Added projectId prop
  onStepCreated: () => void; // Callback to refresh phase list if needed
}

const getStatusBadge = (status: Phase['status']) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500 hover:bg-green-500/80 text-white">Completed</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/80 text-white">In Progress</Badge>;
    case 'not_started':
    default:
      return <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>;
  }
};

const PhaseCard: React.FC<PhaseCardProps> = ({ phase, projectId, onStepCreated }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isCreateStepDialogOpen, setIsCreateStepDialogOpen] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader className="p-4 pb-2">
        <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <span className="text-muted-foreground">{phase.phase_number}.</span> {phase.phase_name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(phase.status)}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  <span className="sr-only">Toggle steps</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription className="mt-2">
            <Progress value={phase.completion_percentage} className="h-2" />
            <span className="text-sm text-muted-foreground mt-1 block">
              {phase.completion_percentage}% Complete
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
              <StepList phaseId={phase.id} projectId={projectId} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
      <CreateStepDialog
        phaseId={phase.id}
        isOpen={isCreateStepDialogOpen}
        onClose={() => setIsCreateStepDialogOpen(false)}
        onStepCreated={onStepCreated}
      />
    </Card>
  );
};

export default PhaseCard;