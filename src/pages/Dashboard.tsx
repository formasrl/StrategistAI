import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

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
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sidebar-foreground">Roadmap</h2>
          <p className="text-sidebar-foreground/80">Phase 1: Discovery</p>
          <p className="text-sidebar-foreground/80">Phase 2: Strategy</p>
          {/* More phases will go here */}
          <Button onClick={handleLogout} variant="destructive" className="w-full">
            Logout
          </Button>
        </div>
      }
      mainContent={
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard!</h1>
          <p className="text-lg text-muted-foreground">
            Select a project or create a new one to get started.
          </p>
          <Button onClick={() => navigate('/project/new')} className="mt-4">
            Create New Project
          </Button>
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