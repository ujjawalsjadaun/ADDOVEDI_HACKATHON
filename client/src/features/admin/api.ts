import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateHospitalInput,
  CreateUserInput,
  HospitalAdmin,
  HospitalDecisionInput,
  HospitalVerificationStatus,
  UserAdmin,
  UserRole,
  UserStatusInput,
} from '@golden-hour/shared';
import { api } from '../../lib/api/client';

const HOSPITALS_KEY = ['admin', 'hospitals'] as const;
const USERS_KEY = ['admin', 'users'] as const;

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export function useAdminHospitals(filter: { verificationStatus?: HospitalVerificationStatus; page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...HOSPITALS_KEY, filter],
    queryFn: () => api<HospitalAdmin[]>(`/admin/hospitals${qs(filter)}`),
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
    queryFn: () => api<UserAdmin[]>(`/admin/users${qs(filter)}`),
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
