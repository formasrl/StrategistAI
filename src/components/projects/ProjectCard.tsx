import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  isActive: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, isActive }) => {
  return (
    <Link to={`/dashboard/${project.id}`}>
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        className="w-full justify-start h-auto p-2"
      >
        <Card className="w-full border-none shadow-none bg-transparent">
          <CardHeader className="p-0 pb-1 flex flex-row items-center space-x-2">
            <FolderOpen className="h-4 w-4 text-sidebar-foreground" />
            <CardTitle className="text-sm font-medium text-sidebar-foreground text-left">
              {project.name}
            </CardTitle>
          </CardHeader>
          {project.business_type && (
            <CardContent className="p-0 text-xs text-sidebar-foreground/70 text-left">
              {project.business_type}
            </CardContent>
          )}
        </Card>
      </Button>
    </Link>
  );
};

export default ProjectCard;