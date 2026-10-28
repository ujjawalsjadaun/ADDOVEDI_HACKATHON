import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api/client';
import { ME_QUERY_KEY } from '../features/auth/api';

export function createQueryClient() {
  // A 401 anywhere means the session expired or was revoked: re-check it so guards redirect to login.
  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') {
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    }
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        // Retry only transient failures; auth and validation errors won't fix themselves.
        retry: (count, err) =>
          count < 2 && err instanceof ApiError && ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(err.code),
      },
      mutations: { retry: false },
    },
  });
  return queryClient;
}
