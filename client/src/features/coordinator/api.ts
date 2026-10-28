import { useQuery } from '@tanstack/react-query';
import type { CoordinatorRequestView } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

export function useCoordinatorRequests() {
  return useQuery({
    queryKey: ['coordinator', 'requests'],
    queryFn: async () => (await api<CoordinatorRequestView[]>('/dashboard/coordinator')).data,
    refetchInterval: 30_000,
  });
}
