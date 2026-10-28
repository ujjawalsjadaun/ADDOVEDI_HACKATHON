import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTransportTaskInput, TransportActionInput, TransportTaskView } from '@golden-hour/shared';
import { api } from '../../lib/api/client';
import { toQueryString } from '../../lib/api/queryString';

// Transport tasks — shared by hospital (request detail), coordinator and admin views.

const TRANSPORT_KEY = ['transport'] as const;

export function useTransportTasks(query: { scope?: 'open' | 'mine' | 'facility' | 'all'; requestId?: string }) {
  return useQuery({
    queryKey: [...TRANSPORT_KEY, query],
    queryFn: async () => (await api<TransportTaskView[]>(`/transport-tasks${toQueryString(query)}`)).data,
    refetchInterval: 30_000,
  });
}

export function useCreateTransportTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransportTaskInput) => (await api<TransportTaskView>('/transport-tasks', { method: 'POST', body: input })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSPORT_KEY }),
  });
}

export function useTransportAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TransportActionInput & { id: string }) =>
      (await api<TransportTaskView>(`/transport-tasks/${id}/status`, { method: 'POST', body })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRANSPORT_KEY }),
  });
}
