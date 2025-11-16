import React, { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { initializeUserTimezone } from '@/utils/dateUtils';

const AppSetupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { setTheme } = useTheme();
  const [isSetupComplete, setIsSetupComplete] = React.useState(false);

  useEffect(() => {
    const performSetup = async () => {
      if (!isSessionLoading) {
        let userTheme: 'light' | 'dark' = 'light';
        let userTimezone: string = 'UTC';

        if (user) {
          const { data, error } = await supabase
            .from('user_settings')
            .select('theme, timezone')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error("Error fetching user settings for setup:", error);
          } else if (data) {
            userTheme = (data.theme as 'light' | 'dark') || 'light';
            userTimezone = data.timezone || 'UTC';
          }
        }

        // Apply theme
        setTheme(userTheme);

        // Initialize timezone utility
        await initializeUserTimezone(user?.id);

        setIsSetupComplete(true);
      }
    };

    if (!isSetupComplete) {
      performSetup();
    }
  }, [user, isSessionLoading, setTheme, isSetupComplete]);

  // Render children only after setup is complete to avoid initial flashes/incorrect data
  if (!isSetupComplete) {
    return null; // Or a loading spinner if desired
  }

  return <>{children}</>;
};

export default AppSetupProvider;