import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CandidatePreview,
  DuplicateReviewInput,
  FulfillRequestInput,
  ReasonedTransitionInput,
  RequestDetail,
  ReviewFlagInput,
  VerifyRequestInput,
} from '@golden-hour/shared';
import { api, ApiError } from '../../lib/api/client';

// Request detail is shared by the hospital and admin areas; the server decides what each may do.

export const REQUESTS_KEY = ['requests'] as const;

export function useRequest(id: string) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'detail', id],
    queryFn: async () => (await api<RequestDetail>(`/requests/${id}`)).data,
    refetchInterval: 20_000,
  });
}

type ActionBody =
  | { action: 'verify'; body: VerifyRequestInput }
  | { action: 'reject'; body: ReasonedTransitionInput }
  | { action: 'cancel'; body: ReasonedTransitionInput }
  | { action: 'duplicate-review'; body: DuplicateReviewInput }
  | { action: 'fulfill'; body: FulfillRequestInput }
  | { action: 'alerts/next-batch'; body: { expectedVersion: number; reason: string } }
  | { action: 'review-flag'; body: ReviewFlagInput };

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
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'dashboard'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}

export function useCandidates(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'candidates', id],
    queryFn: async () => (await api<CandidatePreview>(`/requests/${id}/candidates`)).data,
    enabled,
    staleTime: 30_000,
  });
}

type AssignmentAction =
  | { action: 'confirm-arrival'; assignmentId: string; body: { expectedVersion: number } }
  | { action: 'donated'; assignmentId: string; body: { expectedVersion: number } }
  | { action: 'no-show'; assignmentId: string; body: { expectedVersion: number; reason: string; needStillExists: boolean } };

/** Hospital confirmations on a donor assignment; the server returns the refreshed request. */
export function useAssignmentAction(requestId: string) {
  const queryClient = useQueryClient();
  const detailKey = [...REQUESTS_KEY, 'detail', requestId];
  return useMutation({
    mutationFn: async ({ action, assignmentId, body }: AssignmentAction) =>
      (await api<RequestDetail>(`/assignments/${assignmentId}/${action}`, { method: 'POST', body })).data,
    onSuccess: (detail) => {
      queryClient.setQueryData(detailKey, detail);
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'candidates', requestId] });
      void queryClient.invalidateQueries({ queryKey: [...REQUESTS_KEY, 'dashboard'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}
