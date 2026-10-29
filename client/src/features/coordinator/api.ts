import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoordinatorRequestView, RelayAlertView, VouchFamilyLeadInput } from '@golden-hour/shared';
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

export function useRelayAlerts() {
  return useQuery({
    queryKey: ['coordinator', 'relay'],
    queryFn: async () => (await api<RelayAlertView[]>('/relay/alerts')).data,
    refetchInterval: 20_000,
  });
}

export function useMarkRelayed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => (await api<{ relayed: true }>(`/relay/alerts/${alertId}/relayed`, { method: 'POST', body: {} })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['coordinator', 'relay'] }),
  });
}
