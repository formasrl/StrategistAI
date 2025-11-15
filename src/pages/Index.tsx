import { useSession } from "@/integrations/supabase/SessionContextProvider";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MadeWithDyad } from "@/components/made-with-dyad"; // Keep MadeWithDyad for initial loading state

const Index = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();
  const [hasProjects, setHasProjects] = useState<boolean | null>(null);

  useEffect(() => {
    const checkProjects = async () => {
      if (!isLoading && session) {
        const { data, error } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (error) {
          console.error("Error checking projects:", error);
          setHasProjects(false); // Assume no projects or error means no projects to show
        } else {
          setHasProjects(data && data.length > 0);
        }
      } else if (!isLoading && !session) {
        navigate('/login');
      }
    };

    checkProjects();
  }, [session, isLoading, navigate]);

  useEffect(() => {
    if (hasProjects !== null) {
      if (hasProjects) {
        navigate('/dashboard');
      } else {
        navigate('/project/new');
      }
    }
  }, [hasProjects, navigate]);

  if (isLoading || hasProjects === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl">Loading Brandly...</p>
        <MadeWithDyad />
      </div>
    );
  }

  return null; // Should redirect before rendering anything here
};

export default Index;