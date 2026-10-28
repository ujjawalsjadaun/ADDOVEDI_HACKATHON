import { useMutation, useQuery } from '@tanstack/react-query';
import type { CreateFamilyLeadInput, FamilyLeadReceipt, HospitalPublic } from '@golden-hour/shared';
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
