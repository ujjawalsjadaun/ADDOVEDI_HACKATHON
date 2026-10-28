import { DataFreshness } from '../../components/ui/DataFreshness';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { URGENCY_LABEL, URGENCY_TONE } from '../../lib/labels';
import { useCoordinatorRequests } from './api';

/**
 * Coordinator overview: verified, active requests across facilities — logistics only (no patient or donor
 * identity). Road reports are on the Map & roads tab; transport tasks on the Transport tab.
 */
export function CoordinatorRequestsPage() {
  const q = useCoordinatorRequests();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Active requests</h1>
          <p className="text-xs text-slate-500">Verified emergency requests requiring blood, sorted by earliest deadline.</p>
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
        <ul className="space-y-3.5">
          {q.data!.map((r) => {
            const progressPct = Math.min(100, Math.round((r.slotsFilled / r.unitsRequested) * 100));
            return (
              <li key={r.id} className="card border-slate-200 hover:border-slate-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center justify-center rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-base font-bold text-brand-700 border border-brand-200">
                      {r.bloodGroup}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{r.facility.name}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                          {r.facility.district}
                        </span>
                      </div>
                      <span className="font-mono text-2xs text-slate-400">Code: {r.publicCode}</span>
                    </div>
                  </div>
                  <StatusBadge status={r.urgency} label={URGENCY_LABEL[r.urgency]} tone={URGENCY_TONE[r.urgency]} />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Assignment Progress</span>
                      <span>{r.slotsFilled} / {r.unitsRequested} assigned</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-brand-500' : 'bg-slate-200'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {r.donorsOnTheWay > 0 && (
                      <p className="mt-1 text-2xs font-medium text-emerald-700">
                        {r.donorsOnTheWay} donor{r.donorsOnTheWay > 1 ? 's' : ''} currently en route
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Deadline: {formatDateTime(r.deadlineAt)}</span>
                      <span className="font-semibold text-brand-700">({relativeTime(r.deadlineAt)})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-2xs text-slate-500">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{r.facility.address}</span>
                      <span>·</span>
                      <a
                        className="font-semibold text-brand-700 hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${r.facility.location.lat}&mlon=${r.facility.location.lng}#map=13/${r.facility.location.lat}/${r.facility.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Map
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
