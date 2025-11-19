import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { initializeUserTimezone } from '@/utils/dateUtils';
import { RealtimeChannel } from '@supabase/supabase-js';
import { showError, showSuccess } from '@/utils/toast';
import { Document } from '@/types/supabase';

interface AppSetupContextType {
  onboardingTourCompleted: boolean;
  markOnboardingTourComplete: () => Promise<void>;
}

const AppSetupContext = createContext<AppSetupContextType | undefined>(undefined);

export const useAppSetup = () => {
  const context = useContext(AppSetupContext);
  if (context === undefined) {
    throw new Error('useAppSetup must be used within an AppSetupProvider');
  }
  return context;
};

const AppSetupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, isLoading: isSessionLoading } = useSession();
  const { setTheme } = useTheme();
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [onboardingTourCompleted, setOnboardingTourCompleted] = useState(false);
  const documentStatusChannelRef = useRef<RealtimeChannel | null>(null);

  const markOnboardingTourComplete = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, onboarding_tour_completed: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('Failed to mark onboarding tour complete:', error);
      showError('Failed to save tour completion status.');
    } else {
      setOnboardingTourCompleted(true);
    }
  }, [user]);

  useEffect(() => {
    const performSetup = async () => {
      if (!isSessionLoading) {
        let userTheme: 'light' | 'dark' = 'light';
        let tourStatus = false;

        if (user) {
          const { data, error } = await supabase
            .from('user_settings')
            .select('theme, timezone, onboarding_tour_completed')
            .eq('user_id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error("Error fetching user settings for setup:", error);
          } else if (data) {
            userTheme = (data.theme as 'light' | 'dark') || 'light';
            tourStatus = data.onboarding_tour_completed ?? false;
          }
        }

        setTheme(userTheme);
        await initializeUserTimezone(user?.id);
        setOnboardingTourCompleted(tourStatus);
        setIsSetupComplete(true);
      }
    };

    if (!isSetupComplete) {
      performSetup();
    }
  }, [user, isSessionLoading, setTheme, isSetupComplete]);

  useEffect(() => {
    if (!user || !session || isSessionLoading || !isSetupComplete) {
      if (documentStatusChannelRef.current) {
        supabase.removeChannel(documentStatusChannelRef.current);
        documentStatusChannelRef.current = null;
      }
      return;
    }

    if (!documentStatusChannelRef.current) {
      const channel = supabase
        .channel(`document_status_changes_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'documents',
          },
          async (payload) => {
            const oldDocument = payload.old as Document;
            const newDocument = payload.new as Document;
            const oldStatus = oldDocument.status;
            const newStatus = newDocument.status;

            if (
              (newStatus === 'complete' || newStatus === 'approved') &&
              oldStatus !== 'complete' &&
              oldStatus !== 'approved'
            ) {
              console.log(`Document ${newDocument.id} status changed to ${newStatus}. Triggering summary.`);
              try {
                const { error } = await supabase.functions.invoke('generate-step-summary', {
                  body: {
                    step_document_id: newDocument.id,
                    project_id: newDocument.project_id,
                  },
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                });

                if (error) {
                  console.error('Error invoking generate-step-summary:', error);
                  showError(`Automatic summary failed for document ${newDocument.document_name}: ${error.message}`);
                } else {
                  showSuccess(`Summary refreshed for document "${newDocument.document_name}".`);
                }
              } catch (invokeError: any) {
                console.error('Unexpected error during summary invocation:', invokeError);
                showError(`An unexpected error occurred during summary for document "${newDocument.document_name}".`);
              }
            }
          }
        )
        .subscribe();

      documentStatusChannelRef.current = channel;
    }

    return () => {
      if (documentStatusChannelRef.current) {
        supabase.removeChannel(documentStatusChannelRef.current);
        documentStatusChannelRef.current = null;
      }
    };
  }, [user, session, isSessionLoading, isSetupComplete]);

  if (!isSetupComplete) {
    return null;
  }

  return (
    <AppSetupContext.Provider value={{ onboardingTourCompleted, markOnboardingTourComplete }}>
      {children}
    </AppSetupContext.Provider>
  );
};

export default AppSetupProvider;