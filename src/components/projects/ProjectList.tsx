import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { Project } from '@/types/supabase';
import ProjectCard from './ProjectCard';
import { showError } from '@/utils/toast';
import { useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectListProps {
  refreshTrigger?: number;
}

const ProjectList: React.FC<ProjectListProps> = ({ refreshTrigger = 0 }) => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const location = useLocation();
  const activeProjectId = location.pathname.split('/')[2]; // Extract project ID from URL

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        setIsLoadingProjects(false);
        return;
      }

      // Only show loading skeleton on initial load or if explicitly desired
      if (projects.length === 0) setIsLoadingProjects(true);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        showError(`Failed to load projects: ${error.message}`);
        setProjects([]);
      } else {
        setProjects(data || []);
      }
      setIsLoadingProjects(false);
    };

    if (!isSessionLoading) {
      fetchProjects();
    }
  }, [user, isSessionLoading, refreshTrigger]);

  if (isLoadingProjects || isSessionLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (projects.length === 0) {
    return <p className="text-sidebar-foreground/70 text-sm">No projects found. Create one!</p>;
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} isActive={project.id === activeProjectId} />
      ))}
    </div>
  );
};

export default ProjectList;