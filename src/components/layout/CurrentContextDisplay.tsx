import React from 'react';
import { Project, Phase, Step, Document } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CurrentContextDisplayProps {
  activeProject: Project | null;
  activePhase: Phase | null;
  activeStep: Step | null;
  activeDocument: Document | null;
}

const CurrentContextDisplay: React.FC<CurrentContextDisplayProps> = ({
  activeProject,
  activePhase,
  activeStep,
  activeDocument,
}) => {
  if (!activeProject && !activePhase && !activeStep && !activeDocument) {
    return null; // Don't render if no context is active
  }

  return (
    <Card className="mb-4 bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4" /> Current Context
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs space-y-1">
        {activeProject && (
          <div className="flex items-center gap-1">
            <span className="font-medium">Project:</span>
            <Link to={`/dashboard/${activeProject.id}`} className="hover:underline text-sidebar-primary">
              {activeProject.name}
            </Link>
          </div>
        )}
        {activePhase && (
          <div className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">Phase:</span>
            <span className="text-sidebar-foreground/80">
              {activePhase.phase_number}. {activePhase.phase_name}
            </span>
          </div>
        )}
        {activeStep && (
          <div className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">Step:</span>
            <Link to={`/dashboard/${activeProject?.id}/step/${activeStep.id}`} className="hover:underline text-sidebar-primary">
              {activeStep.step_number}. {activeStep.step_name}
            </Link>
          </div>
        )}
        {activeDocument && (
          <div className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">Document:</span>
            <Link to={`/dashboard/${activeProject?.id}/document/${activeDocument.id}`} className="hover:underline text-sidebar-primary">
              {activeDocument.document_name}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CurrentContextDisplay;