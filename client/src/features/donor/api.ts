import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DonorAlertReportInput,
  DonorAlertView,
  DonorAssignmentStatusInput,
  DonorAssignmentView,
  DonorAvailability,
  DonorProfileView,
  RespondAlertResult,
  UpdateDonorProfileInput,
} from '@golden-hour/shared';
import { api, ApiError } from '../../lib/api/client';

const DONOR_KEY = ['donor'] as const;
const PROFILE_KEY = [...DONOR_KEY, 'profile'] as const;
const ALERTS_KEY = [...DONOR_KEY, 'alerts'] as const;
const ASSIGNMENTS_KEY = [...DONOR_KEY, 'assignments'] as const;

export function useDonorProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: async () => (await api<DonorProfileView>('/donors/me')).data });
}

export function useDonorAlerts() {
  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: async () => (await api<DonorAlertView[]>('/donors/me/alerts')).data,
    refetchInterval: 15_000,
  });
}

export function useDonorAssignments() {
  return useQuery({
    queryKey: ASSIGNMENTS_KEY,
    queryFn: async () => (await api<DonorAssignmentView[]>('/donors/me/assignments')).data,
    refetchInterval: 20_000,
  });
}

export function useUpdateDonorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDonorProfileInput) => (await api<DonorProfileView>('/donors/me', { method: 'PUT', body: input })).data,
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  });
}

export function useLastDonationUnknown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api<DonorProfileView>('/donors/me/last-donation-unknown', { method: 'POST' })).data,
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (availability: DonorAvailability) =>
      (await api<DonorProfileView>('/donors/me/availability', { method: 'POST', body: { availability } })).data,
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  });
}

export function useReportAlert() {
  return useMutation({
    mutationFn: async ({ alertId, ...body }: DonorAlertReportInput & { alertId: string }) =>
      (await api<{ reported: true }>(`/alerts/${alertId}/report`, { method: 'POST', body })).data,
  });
}

/** Accept/decline. Any outcome (including "slots filled") refreshes alerts and assignments. */
export function useRespondAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertId, decision }: { alertId: string; decision: 'accept' | 'decline' }) =>
      (await api<RespondAlertResult>(`/alerts/${alertId}/respond`, { method: 'POST', body: { decision } })).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: DonorAssignmentStatusInput & { id: string }) =>
      (await api<DonorAssignmentView>(`/assignments/${id}/status`, { method: 'POST', body })).data,
    onSettled: (_data, err) => {
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });
}
