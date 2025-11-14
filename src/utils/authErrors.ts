import { AuthApiError } from '@supabase/supabase-js';

export const handleAuthError = (error: unknown): string => {
  if (error instanceof AuthApiError) {
    return error.message;
  }
  return 'An unexpected authentication error occurred.';
};