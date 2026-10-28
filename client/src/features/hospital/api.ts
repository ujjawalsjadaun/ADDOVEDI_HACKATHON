import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRequestInput,
  CreateRequestResult,
  DuplicateReviewInput,
  FulfillRequestInput,
  ReasonedTransitionInput,
  RequestDetail,
  RequestStatus,
  RequestSummary,
  RequestVerificationStatus,
  VerifyRequestInput,
} from '@golden-hour/shared';
import { api, ApiError } from '../../lib/api/client';

export const REQUESTS_KEY = ['requests'] as const;

export interface RequestFilter {
  requestStatus?: RequestStatus;
  verificationStatus?: RequestVerificationStatus;
  active?: 'true' | 'false';
  page?: number;
  limit?: number;
}

function qs(params: object): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export function useRequests(filter: RequestFilter) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'list', filter],
    queryFn: () => api<RequestSummary[]>(`/requests${qs(filter)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'detail', id],
    queryFn: async () => (await api<RequestDetail>(`/requests/${id}`)).data,
    refetchInterval: 20_000,
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
    },
  });
}

type ActionBody =
  | { action: 'verify'; body: VerifyRequestInput }
  | { action: 'reject'; body: ReasonedTransitionInput }
  | { action: 'cancel'; body: ReasonedTransitionInput }
  | { action: 'duplicate-review'; body: DuplicateReviewInput }
  | { action: 'fulfill'; body: FulfillRequestInput };

/** Runs one request transition. On a 409 the cached request is refreshed so the UI shows the new state. */
export function useRequestAction(id: string) {
  const queryClient = useQueryClient();
  const detailKey = [...REQUESTS_KEY, 'detail', id];
  return useMutation({
    mutationFn: async ({ action, body }: ActionBody) =>
      (await api<RequestDetail>(`/requests/${id}/${action}`, { method: 'POST', body })).data,
    onSuccess: (detail) => {
      queryClient.setQueryData(detailKey, detail);
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'list'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}
