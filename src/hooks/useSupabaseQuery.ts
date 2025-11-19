import { useQuery, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

type SupabaseQueryFunction<T> = () => Promise<{ data: T | null; error: PostgrestError | null }>;

/**
 * @name useSupabaseQuery
 * @description A custom hook for fetching data from Supabase with React Query.
 * @param queryKey The key to use for the query.
 * @param queryFn The Supabase query function to execute.
 * @returns {object} The result of the query.
 */
export const useSupabaseQuery = <T>(
  queryKey: QueryKey,
  queryFn: SupabaseQueryFunction<T>
): UseQueryResult<T | null, PostgrestError> => {
  return useQuery<T | null, PostgrestError>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryFn();
      if (error) {
        throw error;
      }
      return data;
    },
  });
};
