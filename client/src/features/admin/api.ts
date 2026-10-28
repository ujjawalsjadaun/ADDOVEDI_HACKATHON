import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminDonorView,
  AdminOverview,
  AuditEntryView,
  NotificationQueueHealth,
  NotificationStatus,
  NotificationView,
  RequestSummary,
  SuspiciousReportView,
  CreateHospitalInput,
  DonorReviewStatus,
  DonorVerificationStatus,
  CreateUserInput,
  HospitalAdmin,
  HospitalDecisionInput,
  HospitalVerificationStatus,
  UserAdmin,
  UserRole,
  UserStatusInput,
} from '@golden-hour/shared';
import { api } from '../../lib/api/client';
import { toQueryString } from '../../lib/api/queryString';

const HOSPITALS_KEY = ['admin', 'hospitals'] as const;
const USERS_KEY = ['admin', 'users'] as const;

export function useAdminHospitals(filter: { verificationStatus?: HospitalVerificationStatus; page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...HOSPITALS_KEY, filter],
    queryFn: () => api<HospitalAdmin[]>(`/admin/hospitals${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateHospital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHospitalInput) =>
      (await api<HospitalAdmin>('/admin/hospitals', { method: 'POST', body: input })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOSPITALS_KEY }),
  });
}

export function useHospitalDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: HospitalDecisionInput & { id: string }) =>
      (await api<HospitalAdmin>(`/admin/hospitals/${id}/verification`, { method: 'POST', body: input })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: HOSPITALS_KEY }),
  });
}

export function useAdminUsers(filter: { role?: UserRole; page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...USERS_KEY, filter],
    queryFn: () => api<UserAdmin[]>(`/admin/users${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => (await api<UserAdmin>('/admin/users', { method: 'POST', body: input })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: HOSPITALS_KEY }); // staff counts
    },
  });
}

export function useUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UserStatusInput & { id: string }) =>
      (await api<UserAdmin>(`/admin/users/${id}/status`, { method: 'POST', body: input })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

const DONORS_KEY = ['admin', 'donors'] as const;

export function useAdminDonors(filter: { verificationStatus?: DonorVerificationStatus; reviewStatus?: DonorReviewStatus; limit?: number }) {
  return useQuery({
    queryKey: [...DONORS_KEY, filter],
    queryFn: () => api<AdminDonorView[]>(`/admin/donors${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
  });
}

export function useDonorDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, kind, decision, reason }: { userId: string; kind: 'verification' | 'review'; decision: string; reason: string }) =>
      (await api<AdminDonorView>(`/admin/donors/${userId}/${kind}`, { method: 'POST', body: { decision, reason } })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: DONORS_KEY }),
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => (await api<AdminOverview>('/admin/overview')).data,
    refetchInterval: 30_000,
  });
}

export function useAdminRequests(filter: { active?: 'true' | 'false'; requestStatus?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['requests', 'list', 'admin', filter],
    queryFn: () => api<RequestSummary[]>(`/requests${toQueryString(filter)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export interface AuditFilter {
  action?: string;
  resourceType?: 'user' | 'hospital' | 'bloodRequest' | 'roadReport' | 'familyLead' | 'stockTransfer';
  result?: 'success' | 'denied' | 'failed';
  page?: number;
  limit?: number;
}

export function useAuditLog(filter: AuditFilter) {
  return useQuery({
    queryKey: ['admin', 'audit', filter],
    queryFn: () => api<AuditEntryView[]>(`/admin/audit${toQueryString({ ...filter })}`),
    placeholderData: keepPreviousData,
  });
}

const REPORTS_KEY = ['admin', 'reports'] as const;

export function useSuspiciousReports(status: 'open' | 'reviewed' | undefined) {
  return useQuery({
    queryKey: [...REPORTS_KEY, status],
    queryFn: () => api<SuspiciousReportView[]>(`/admin/suspicious-reports${toQueryString({ status, limit: 50 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useReviewReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/admin/suspicious-reports/${id}/review`, { method: 'POST', body: { reason } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

// ── notifications (outbox) ───────────────────────────────────────────────────

const NOTIFICATIONS_KEY = ['admin', 'notifications'] as const;

export function useNotifications(status: NotificationStatus | undefined) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list', status],
    queryFn: () => api<NotificationView[]>(`/admin/notifications${toQueryString({ status, limit: 50 })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useNotificationHealth() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'health'],
    queryFn: async () => (await api<NotificationQueueHealth>('/admin/notifications/health')).data,
    refetchInterval: 30_000,
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/admin/notifications/${id}/retry`, { method: 'POST', body: { reason } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
