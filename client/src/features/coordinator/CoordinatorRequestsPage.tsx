import { DataFreshness } from '../../components/ui/DataFreshness';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { URGENCY_LABEL, URGENCY_TONE } from '../../lib/labels';
import { useCoordinatorRequests } from './api';

/**
 * Coordinator overview: verified, active requests across facilities — logistics only (no patient or donor
 * identity). Road reports are on the Map & roads tab; transport tasks arrive in Phase 8.
 */
export function CoordinatorRequestsPage() {
  const q = useCoordinatorRequests();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Active requests</h1>
          <p className="text-sm text-slate-600">Verified requests that still need blood, soonest deadline first.</p>
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>

      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title="No active verified requests">Nothing needs coordination right now.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {q.data!.map((r) => (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-lg font-bold text-brand-700">{r.bloodGroup}</span>
                <span className="font-semibold">{r.facility.name}</span>
                <span className="text-sm text-slate-600">{r.facility.district}</span>
                <StatusBadge status={r.urgency} label={URGENCY_LABEL[r.urgency]} tone={URGENCY_TONE[r.urgency]} />
                <span className="font-mono text-xs text-slate-500">{r.publicCode}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {r.slotsFilled}/{r.unitsRequested} donor(s) assigned · {r.donorsOnTheWay} travelling · due {formatDateTime(r.deadlineAt)} (
                {relativeTime(r.deadlineAt)})
              </p>
              <p className="text-sm text-slate-600">
                {r.facility.address} ·{' '}
                <a
                  className="text-brand-700 underline"
                  href={`https://www.openstreetmap.org/?mlat=${r.facility.location.lat}&mlon=${r.facility.location.lng}#map=13/${r.facility.location.lat}/${r.facility.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  map
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">Transport tasks arrive in a later phase.</p>
    </div>
  );
}
