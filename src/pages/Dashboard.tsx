import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import ProjectList from '@/components/projects/ProjectList';
import { PlusCircle, Settings, LogOut } from 'lucide-react'; // Added Settings and LogOut icons

const Dashboard = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/login');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(`Logout failed: ${error.message}`);
    } else {
      showSuccess('You have been logged out.');
      navigate('/login');
    }
  };

  return (
    <DashboardLayout
      sidebar={
        <div className="space-y-4 flex flex-col h-full">
          <h2 className="text-xl font-semibold text-sidebar-foreground">Your Projects</h2>
          <Button onClick={() => navigate('/project/new')} className="w-full" variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Project
          </Button>
          <div className="flex-1 overflow-y-auto">
            <ProjectList />
          </div>
          <div className="pt-4 border-t border-sidebar-border space-y-2">
            <Button onClick={() => navigate('/settings')} className="w-full" variant="ghost">
              <Settings className="mr-2 h-4 w-4" /> AI Settings
            </Button>
            <Button onClick={handleLogout} variant="destructive" className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      }
      mainContent={
        <div className="h-full">
          <Outlet /> {/* Renders nested routes like ProjectDetails */}
        </div>
      }
      aiPanel={
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sidebar-foreground">AI Assistant</h2>
          <p className="text-sidebar-foreground/80">AI suggestions will appear here.</p>
        </div>
      }
    />
  );
};

export default Dashboard;