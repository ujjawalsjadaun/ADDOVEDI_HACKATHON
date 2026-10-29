import { useMutation, useQuery } from '@tanstack/react-query';
import type { CreateFamilyLeadInput, FamilyLeadReceipt, HospitalPublic, VerifyFamilyPhoneInput } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

export function usePublicFacilities() {
  return useQuery({
    queryKey: ['hospitals', 'public'],
    queryFn: async () => (await api<HospitalPublic[]>('/hospitals')).data,
    staleTime: 5 * 60_000,
  });
}

export function useSubmitFamilyLead() {
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: { input: CreateFamilyLeadInput; idempotencyKey: string }) =>
      (await api<FamilyLeadReceipt>('/family-leads', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } })).data,
  });
}

export function useVerifyFamilyPhone() {
  return useMutation({
    mutationFn: async (input: VerifyFamilyPhoneInput) => (await api<{ verified: true }>('/family-leads/verify-phone', { method: 'POST', body: input })).data,
  });
}
