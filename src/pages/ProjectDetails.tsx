import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/supabase';
import { showError, showSuccess } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PhaseList from '@/components/phases/PhaseList';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react'; // Import Pencil icon
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EditProjectDialog from '@/components/projects/EditProjectDialog'; // Import the new dialog
import { formatDateTime } from '@/utils/dateUtils'; // New import

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog

  const fetchProject = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleDeleteProject = async () => {
    if (!projectId) return;

    setIsDeleting(true);
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      showError(`Failed to delete project: ${error.message}`);
    } else {
      showSuccess('Project deleted successfully!');
      navigate('/dashboard');
    }
    setIsDeleting(false);
  };

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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold">{project.name}</CardTitle>
            {project.business_type && (
              <CardDescription className="text-lg text-muted-foreground">
                Business Type: {project.business_type}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Project
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : <><Trash2 className="mr-2 h-4 w-4" /> Delete Project</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your project
                    and all associated data (phases, steps, documents, AI reviews).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
            <p className="text-muted-foreground">{formatDateTime(project.created_at, 'MMM d, yyyy')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Project Roadmap (Phases and Steps) */}
      <Card className="w-full p-4">
        <h2 className="text-2xl font-bold mb-4">Project Roadmap</h2>
        <PhaseList projectId={project.id} />
      </Card>

      {project && (
        <EditProjectDialog
          project={project}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onProjectUpdated={fetchProject} // Re-fetch project details after update
        />
      )}
    </div>
  );
};

export default ProjectDetails;