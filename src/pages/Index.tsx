import { useSession } from "@/integrations/supabase/SessionContextProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        navigate('/dashboard'); // Always redirect to dashboard if authenticated
      } else {
        navigate('/login');
      }
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
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