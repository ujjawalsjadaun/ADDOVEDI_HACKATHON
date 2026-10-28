import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, MeResponse } from '@golden-hour/shared';
import { api, ApiError } from '../../lib/api/client';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

/** Current session. `null` means signed out; errors other than 401 surface as query errors. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<MeResponse | null> => {
      try {
        return (await api<MeResponse>('/auth/me')).data;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api<MeResponse>('/auth/login', { method: 'POST', body: input })).data,
    onSuccess: (me) => {
      queryClient.setQueryData(ME_QUERY_KEY, me);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      // Drop every cached resource so the next user never sees the previous user's data.
      queryClient.clear();
      queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  });
}
