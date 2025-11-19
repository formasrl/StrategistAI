import { renderHook, waitFor } from '@testing-library/react';
import { useDocument } from './useDocument';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const queryClient = new QueryClient();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

describe('useDocument', () => {
  it('should fetch a document', async () => {
    const mockDocument = {
      id: '1',
      document_name: 'Test Document',
      content: 'Test Content',
      current_version: 1,
      status: 'draft',
      project_id: '1',
    };

    const fromSpy = vi.spyOn(supabase, 'from');
    const selectSpy = vi.fn().mockReturnThis();
    const eqSpy = vi.fn().mockReturnThis();
    const singleSpy = vi.fn().mockResolvedValueOnce({ data: mockDocument, error: null });

    fromSpy.mockImplementation(() => ({
      select: selectSpy,
      eq: eqSpy,
      single: singleSpy,
    } as any));

    const { result } = renderHook(() => useDocument('1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocument).toBe(false);
    });

    expect(result.current.document).toEqual(mockDocument);
  });
});
