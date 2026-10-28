import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api/client';

export function createQueryClient() {
  return new QueryClient({
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
}
