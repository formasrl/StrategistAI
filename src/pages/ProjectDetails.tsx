import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PhaseList from '@/components/phases/PhaseList'; // New import

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        showError(`Failed to load project details: ${error.message}`);
        setProject(null);
      } else {
        setProject(data);
      }
      setIsLoading(false);
    };

    fetchProject();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return (
      <div className="text-center text-muted-foreground">
        <p>Project not found or an error occurred.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">{project.name}</CardTitle>
          {project.business_type && (
            <CardDescription className="text-lg text-muted-foreground">
              Business Type: {project.business_type}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {project.timeline && (
            <div>
              <h3 className="text-xl font-semibold">Timeline</h3>
              <p className="text-muted-foreground">{project.timeline}</p>
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold">Created At</h3>
            <p className="text-muted-foreground">{new Date(project.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Project Roadmap (Phases and Steps) */}
      <Card className="w-full p-4">
        <h2 className="text-2xl font-bold mb-4">Project Roadmap</h2>
        <PhaseList projectId={project.id} />
      </Card>
    </div>
  );
};

export default ProjectDetails;