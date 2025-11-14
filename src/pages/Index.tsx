import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSession } from "@/integrations/supabase/SessionContextProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
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

  if (!session) {
    return null; // Or a loading spinner, as the redirect will happen
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Welcome to Brandly!</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          You are logged in. Start building your amazing project here!
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;