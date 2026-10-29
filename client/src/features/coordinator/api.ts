import { useMutation, useQuery } from '@tanstack/react-query';
import type { CoordinatorRequestView, VouchFamilyLeadInput } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

export function useCoordinatorRequests() {
  return useQuery({
    queryKey: ['coordinator', 'requests'],
    queryFn: async () => (await api<CoordinatorRequestView[]>('/dashboard/coordinator')).data,
    refetchInterval: 30_000,
  });
}

export function useVouchForLead() {
  return useMutation({
    mutationFn: async (input: VouchFamilyLeadInput) => (await api<{ recorded: true }>('/family-leads/vouch', { method: 'POST', body: input })).data,
  });
}
