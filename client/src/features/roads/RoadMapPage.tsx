import { useState } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import type { LatLng, MapData } from '@golden-hour/shared';
import { MapView } from '../../components/map/MapView';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime } from '../../lib/format';
import { useMe } from '../auth/api';
import { useMapData } from './api';
import { AccessPointForm } from './components/AccessPointForm';
import { CONDITION_LABEL, RoadReportForm } from './components/RoadReportForm';
import { RoadReportList } from './components/RoadReportList';

const COLORS = {
  facility: '#1d4ed8',
  access: '#059669',
  blocked: '#dc2626',
  restricted: '#d97706',
  open: '#16a34a',
  unknown: '#64748b',
  stale: '#94a3b8',
  picked: '#7c3aed',
};

type Mode = 'view' | 'report' | 'access';

/** Map with facilities, vehicle access points and road reports. Shared by hospital, coordinator and admin areas. */
export function RoadMapPage() {
  const me = useMe();
  const q = useMapData();
  const [mode, setMode] = useState<Mode>('view');
  const [picked, setPicked] = useState<LatLng | null>(null);

  if (q.isPending) return <LoadingState />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data!;
  const user = me.data?.user;
  const editableFacilities =
    user?.role === 'hospital_staff' ? d.facilities.filter((f) => f.id === user.facilityId) : user?.role === 'coordinator' || user?.role === 'admin' ? d.facilities : [];

  const start = (m: Mode) => {
    setPicked(null);
    setMode(m);
  };
  const done = () => {
    setPicked(null);
    setMode('view');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Map &amp; road conditions</h2>
          <ProviderNote providers={d.providers} />
          <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={120_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
        </div>
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => start('report')}>
              Report road condition
            </button>
            {editableFacilities.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => start('access')}>
                Set vehicle access point
              </button>
            )}
          </div>
        )}
      </div>

      <MapView
        label="Map of facilities, vehicle access points and road reports"
        fitTo={d.facilities.map((f) => f.location)}
        onPick={mode === 'view' ? undefined : setPicked}
      >
        {d.facilities.map((f) => (
          <CircleMarker key={f.id} center={[f.location.lat, f.location.lng]} radius={9} pathOptions={{ color: COLORS.facility, fillOpacity: 0.8 }}>
            <Popup>
              <strong>{f.name}</strong>
              <br />
              {f.district} · {f.activeRequests} active request(s)
            </Popup>
          </CircleMarker>
        ))}
        {d.facilities.flatMap((f) =>
          f.accessPoint
            ? [
                <CircleMarker
                  key={`ap-${f.id}`}
                  center={[f.accessPoint.location.lat, f.accessPoint.location.lng]}
                  radius={6}
                  pathOptions={{ color: COLORS.access, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <strong>Vehicle access point</strong> for {f.name}
                    {f.accessPoint.note && (
                      <>
                        <br />
                        {f.accessPoint.note}
                      </>
                    )}
                    <br />
                    <span style={{ fontSize: 11 }}>
                      Reported by {f.accessPoint.reportedBy ?? 'staff'}, {formatDateTime(f.accessPoint.reportedAt)}
                    </span>
                  </Popup>
                </CircleMarker>,
              ]
            : [],
        )}
        {d.roadReports.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.location.lat, r.location.lng]}
            radius={r.affectsEta ? 10 : 7}
            pathOptions={{
              color: r.isStale ? COLORS.stale : COLORS[r.condition],
              fillOpacity: r.isStale ? 0.3 : 0.75,
              dashArray: r.verificationStatus === 'verified' ? undefined : '4 3',
            }}
          >
            <Popup>
              <strong>{r.label}</strong>
              <br />
              {CONDITION_LABEL[r.condition]} · {r.verificationStatus} · {r.confidence} confidence
              <br />
              <span style={{ fontSize: 11 }}>
                {r.isStale ? 'Stale — ignored for travel times' : r.affectsEta ? 'Affects travel times' : 'Shown as a warning only'}
              </span>
            </Popup>
          </CircleMarker>
        ))}
        {picked && <CircleMarker center={[picked.lat, picked.lng]} radius={8} pathOptions={{ color: COLORS.picked, fillOpacity: 0.9 }} />}
      </MapView>

      <Legend corridorKm={d.closureCorridorKm} />

      {mode === 'report' && <RoadReportForm picked={picked} onDone={done} />}
      {mode === 'access' && <AccessPointForm facilities={editableFacilities} picked={picked} onDone={done} />}

      <section className="space-y-2">
        <h3 className="font-semibold">Road reports</h3>
        <RoadReportList reports={d.roadReports} />
      </section>
    </div>
  );
}

function ProviderNote({ providers }: { providers: MapData['providers'] }) {
  return (
    <p className="text-xs text-slate-600">
      Travel times:{' '}
      <strong className={providers.routing.simulated ? 'text-amber-800' : ''}>
        {providers.routing.simulated ? 'simulated estimate' : `live (${providers.routing.name})`}
      </strong>{' '}
      · Weather:{' '}
      <strong className={providers.weather.simulated ? 'text-amber-800' : ''}>
        {providers.weather.simulated ? 'simulated' : providers.weather.name}
      </strong>
    </p>
  );
}

function Legend({ corridorKm }: { corridorKm: number }) {
  const items: [string, string][] = [
    [COLORS.facility, 'Facility'],
    [COLORS.access, 'Vehicle access point'],
    [COLORS.blocked, 'Blocked'],
    [COLORS.restricted, 'Restricted'],
    [COLORS.open, 'Open'],
    [COLORS.stale, 'Stale (ignored)'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
      ))}
      <span>Dashed outline = not verified.</span>
      <span>
        A blocked road within {corridorKm} km of a donor's route makes that travel time "unknown" when it is verified or high-confidence.
      </span>
    </div>
  );
}
