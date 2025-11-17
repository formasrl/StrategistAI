import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import { Step } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CircleDot, CircleDashed } from 'lucide-react';
// ... other imports

interface StepCardProps {
  step: Step;
  projectId: string; // Need projectId for the link
  onStepStatusChange: () => void; // Keep this for internal status updates
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
      return 'default';
    case 'in_progress':
      return 'secondary';
    case 'not_started':
    case 'locked':
    default:
      return 'outline';
  }
};

const StepCard: React.FC<StepCardProps> = ({ step, projectId, onStepStatusChange }) => {
  // The onStepStatusChange prop is not directly used within the rendered JSX of StepCard,
  // but it's passed down from StepList to allow for potential future interactions
  // or if StepCard itself were to have internal status-changing logic.

  return (
    <Link to={`/dashboard/${projectId}/step/${step.id}`}> {/* Make the entire card a link */}
      <Card className="mb-4 cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-primary">
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
      </Card>
    </Link>
  );
};

export default StepCard;