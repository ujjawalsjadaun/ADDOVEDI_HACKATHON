import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRequestInput,
  CreateRequestResult,
  CreateStockTransferInput,
  CreateSurplusInput,
  SurplusOfferView,
  FamilyLeadStatus,
  FamilyLeadView,
  HospitalDashboard,
  HospitalPublic,
  RequestDetail,
  StockTransferActionInput,
  StockTransferView,
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

// ── family leads ─────────────────────────────────────────────────────────────

const LEADS_KEY = ['hospital', 'leads'] as const;

export function useFamilyLeads(status: FamilyLeadStatus | undefined) {
  return useQuery({
    queryKey: [...LEADS_KEY, status],
    queryFn: async () => (await api<FamilyLeadView[]>(`/family-leads${toQueryString({ status })}`)).data,
    refetchInterval: 30_000,
  });
}

export function useConfirmLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: CreateRequestInput }) =>
      (await api<RequestDetail>(`/family-leads/${id}/confirm`, { method: 'POST', body: { request } })).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_KEY });
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}

export function useRejectLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api(`/family-leads/${id}/reject`, { method: 'POST', body: { reason } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: LEADS_KEY }),
  });
}

// ── stock transfers ──────────────────────────────────────────────────────────

const TRANSFERS_KEY = ['hospital', 'transfers'] as const;

export function useStockTransfers(direction: 'incoming' | 'outgoing') {
  return useQuery({
    queryKey: [...TRANSFERS_KEY, direction],
    queryFn: async () => (await api<StockTransferView[]>(`/stock-transfers?direction=${direction}`)).data,
    refetchInterval: 30_000,
  });
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: { input: CreateStockTransferInput; idempotencyKey: string }) =>
      (await api<StockTransferView>('/stock-transfers', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY }),
  });
}

export function useStockTransferAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: StockTransferActionInput & { id: string }) =>
      (await api<StockTransferView>(`/stock-transfers/${id}/status`, { method: 'POST', body })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY }),
  });
}

/** Verified facilities (public list) — targets for stock requests. */
export function useVerifiedFacilities() {
  return useQuery({
    queryKey: ['hospitals', 'public'],
    queryFn: async () => (await api<HospitalPublic[]>('/hospitals')).data,
    staleTime: 5 * 60_000,
  });
}

export function useSurplus() {
  return useQuery({
    queryKey: ['surplus'],
    queryFn: async () => (await api<SurplusOfferView[]>('/stock-surplus')).data,
    refetchInterval: 60_000,
  });
}

export function useCreateSurplus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSurplusInput) => (await api<SurplusOfferView>('/stock-surplus', { method: 'POST', body: input })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['surplus'] }),
  });
}

export function useWithdrawSurplus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api<{ withdrawn: true }>(`/stock-surplus/${id}/withdraw`, { method: 'POST', body: {} })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['surplus'] }),
  });
}
