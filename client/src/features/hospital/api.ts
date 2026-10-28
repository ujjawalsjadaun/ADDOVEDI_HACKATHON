import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRequestInput,
  CreateRequestResult,
  HospitalDashboard,
  RequestStatus,
  RequestSummary,
  RequestVerificationStatus,
} from '@golden-hour/shared';
import { api } from '../../lib/api/client';
import { toQueryString } from '../../lib/api/queryString';
import { REQUESTS_KEY } from '../requests/api';

export interface RequestFilter {
  requestStatus?: RequestStatus;
  verificationStatus?: RequestVerificationStatus;
  active?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export function useRequests(filter: RequestFilter) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'list', filter],
    queryFn: () => api<RequestSummary[]>(`/requests${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: { input: CreateRequestInput; idempotencyKey: string }) =>
      (
        await api<CreateRequestResult>('/requests', {
          method: 'POST',
          body: input,
          headers: { 'Idempotency-Key': idempotencyKey },
        })
      ).data,
    onSuccess: (result) => {
      queryClient.setQueryData([...REQUESTS_KEY, 'detail', result.request.id], result.request);
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'list'] });
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'dashboard'] });
    },
  });
}

export function useHospitalDashboard() {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'dashboard'],
    queryFn: async () => (await api<HospitalDashboard>('/dashboard/hospital')).data,
    refetchInterval: 20_000,
  });
}
