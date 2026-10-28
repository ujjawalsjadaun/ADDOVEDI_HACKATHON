import { useMutation, useQuery } from '@tanstack/react-query';
import type { PublicRequestStatus, SuspiciousReportInput } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

export function usePublicStatus(code: string | undefined) {
  return useQuery({
    queryKey: ['public', 'request', code],
    queryFn: async () => (await api<PublicRequestStatus>(`/public/requests/${encodeURIComponent(code!)}`)).data,
    enabled: !!code,
    staleTime: 15_000,
  });
}

export function useReportSuspicious() {
  return useMutation({
    mutationFn: (input: SuspiciousReportInput) => api('/public/reports', { method: 'POST', body: input }),
  });
}
