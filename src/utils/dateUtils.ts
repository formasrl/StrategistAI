import { format as dateFnsFormat } from 'date-fns';
import { utcToZonedTime, formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';

// This will store the user's preferred timezone globally
let currentUserTimezone: string = 'UTC'; // Default to UTC

export const initializeUserTimezone = async (userId: string | undefined) => {
  if (!userId) {
    currentUserTimezone = 'UTC';
    return;
  }
  const { data, error } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error fetching user timezone:", error);
    currentUserTimezone = 'UTC'; // Fallback on error
  } else if (data?.timezone) {
    currentUserTimezone = data.timezone;
  } else {
    currentUserTimezone = 'UTC'; // Default if no setting found
  }
};

export const getUserTimezone = (): string => currentUserTimezone;

/**
 * Formats a date string or Date object into the user's preferred timezone.
 * Assumes input date strings are UTC or local, and converts them to the user's preferred timezone before formatting.
 * @param dateInput The date to format (string or Date object).
 * @param formatStr The format string (e.g., 'MMM d, yyyy HH:mm').
 * @returns The formatted date string.
 */
export const formatDateTime = (dateInput: string | Date, formatStr: string = 'MMM d, yyyy HH:mm'): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  // Convert the date to the user's preferred timezone before formatting
  return formatInTimeZone(date, currentUserTimezone, formatStr);
};