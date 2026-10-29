import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessPointInput, CreateRoadReportInput, LatLng, MapData, NearestRoadResult, RoadReportDecisionInput, RoadReportView } from '@golden-hour/shared';
import { api } from '../../lib/api/client';

// Map, road reports and access points — shared by hospital, coordinator and admin areas.

const MAP_KEY = ['geo', 'map'] as const;

export function useMapData() {
  return useQuery({
    queryKey: MAP_KEY,
    queryFn: async () => (await api<MapData>('/geo/map')).data,
    refetchInterval: 60_000,
  });
}

function useInvalidateMap() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: MAP_KEY });
    // Road reports change travel times shown on requests.
    void queryClient.invalidateQueries({ queryKey: ['requests', 'candidates'] });
  };
}

export function useCreateRoadReport() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: async (input: CreateRoadReportInput) => (await api<RoadReportView>('/road-reports', { method: 'POST', body: input })).data,
    onSuccess: invalidate,
  });
}

export function useDecideRoadReport() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: async ({ id, ...body }: RoadReportDecisionInput & { id: string }) =>
      (await api<RoadReportView>(`/road-reports/${id}/verification`, { method: 'POST', body })).data,
    onSettled: invalidate,
  });
}

export function useSetAccessPoint() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: ({ facilityId, ...body }: AccessPointInput & { facilityId: string }) =>
      api(`/hospitals/${facilityId}/access-point`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

/** Nearest drivable road to a picked location (map data estimate; may be unavailable offline). */
export function useNearestRoad() {
  return useMutation({
    mutationFn: async (location: LatLng) => (await api<NearestRoadResult>('/geo/nearest-road', { method: 'POST', body: { location } })).data,
  });
}
