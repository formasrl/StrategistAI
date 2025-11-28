import React, { useEffect, useState } from 'react';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Project, Profile } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FolderOpen, Clock, ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/utils/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardHome = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoadingData(true);

      // Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileData) setProfile(profileData);

      // Fetch Projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (projectsData) setProjects(projectsData);

      setIsLoadingData(false);
    };

    if (!isSessionLoading) {
      fetchData();
    }
  }, [user, isSessionLoading]);

  if (isSessionLoading || isLoadingData) {
    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
               <Skeleton className="h-12 w-12 rounded-full" />
               <div className="space-y-2">
                 <Skeleton className="h-8 w-64" />
                 <Skeleton className="h-4 w-48" />
               </div>
            </div>
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        </div>
    );
  }

  const displayName = profile?.first_name ? profile.first_name : (user?.email?.split('@')[0] || 'Strategist');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                    <User className="h-8 w-8 text-primary" />
                )}
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome back, {displayName}!</h1>
                <p className="text-muted-foreground mt-1">
                    {projects.length === 0 
                        ? "Ready to build your first brand strategy?" 
                        : `You have ${projects.length} active project${projects.length === 1 ? '' : 's'}.`}
                </p>
            </div>
        </div>
        <Button onClick={() => navigate('/project/new')} size="lg" className="shrink-0">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Project
        </Button>
      </div>

      {/* Projects Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" /> Your Projects
        </h2>
        
        {projects.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                    <p className="text-muted-foreground max-w-sm mb-8">
                        Your dashboard is looking a bit empty. Start your first brand strategy project to get moving.
                    </p>
                    <Button onClick={() => navigate('/project/new')} variant="default">
                        Create Your First Project
                    </Button>
                </CardContent>
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                    <Card 
                        key={project.id} 
                        className="group hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col border-muted-foreground/20 hover:border-primary/50" 
                        onClick={() => navigate(`/dashboard/${project.id}`)}
                    >
                        <CardHeader className="pb-3">
                            <CardTitle className="truncate text-xl group-hover:text-primary transition-colors">
                                {project.name}
                            </CardTitle>
                            <CardDescription className="line-clamp-1">
                                {project.business_type || "Business Type Not Set"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 pb-4">
                            {project.one_liner ? (
                                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                    {project.one_liner}
                                </p>
                            ) : (
                                <div className="h-full flex items-center">
                                    <p className="text-sm text-muted-foreground italic opacity-50">No description available.</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="pt-3 border-t bg-muted/10 text-xs text-muted-foreground flex justify-between items-center">
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" /> 
                                Updated {formatDateTime(project.updated_at, 'MMM d, yyyy')}
                            </span>
                            <span className="flex items-center gap-1 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                                Open Project <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                        </CardFooter>
                    </Card>
                ))}
                 
                 {/* Quick Add Card */}
                 <Card 
                    className="border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center h-full min-h-[220px] group" 
                    onClick={() => navigate('/project/new')}
                >
                    <div className="h-14 w-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                        <PlusCircle className="h-7 w-7 text-primary" />
                    </div>
                    <p className="font-semibold text-primary text-lg">Start New Project</p>
                </Card>
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;