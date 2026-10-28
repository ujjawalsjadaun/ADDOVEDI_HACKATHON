import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { EtaBadge } from '../../components/ui/EtaBadge';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useHospitalDashboard } from './api';
import { ASSIGNMENT_STATUS, requestState } from '../../lib/labels';

export function HospitalDashboardPage() {
  const q = useHospitalDashboard();

  if (q.isPending) return <LoadingState />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data!;
  const canCreate = d.facility.verificationStatus === 'verified';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Today</h2>
          <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={60_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
        </div>
        <div className="flex gap-2">
          <Link to="/hospital/requests" className="btn-secondary">
            All requests
          </Link>
          {canCreate && (
            <Link to="/hospital/requests/new" className="btn-primary">
              New request
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Awaiting verification" value={d.counts.awaitingVerification} alertWhenNonZero="attention" />
        <StatCard label="Possible duplicates" value={d.counts.duplicateReviews} alertWhenNonZero="danger" />
        <StatCard label="Due within 2 hours" value={d.counts.dueWithin2h} alertWhenNonZero="danger" />
        <StatCard label="Waiting for donors" value={d.counts.awaitingDonors} />
        <StatCard label="Donors on the way" value={d.counts.donorsOnTheWay} />
        <StatCard label="Active requests" value={d.counts.active} to="/hospital/requests" />
        <StatCard label="Fulfilled today" value={d.counts.fulfilledToday} tone={d.counts.fulfilledToday > 0 ? 'good' : 'neutral'} />
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold">Needs attention</h3>
        {d.needsAction.length === 0 ? (
          <EmptyState title="Nothing needs action right now">New requests, duplicates and close deadlines appear here.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {d.needsAction.map((r) => {
              const state = requestState(r);
              return (
                <li key={r.id}>
                  <Link to={`/hospital/requests/${r.id}`} className="card block hover:border-brand-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{r.bloodGroup}</span>
                      <span className="font-mono text-sm">{r.publicCode}</span>
                      <StatusBadge status={state.label} label={state.label} tone={state.tone} />
                      <span className="text-sm text-slate-600">
                        {r.slotsFilled}/{r.unitsRequested} · due {formatDateTime(r.deadlineAt)} ({relativeTime(r.deadlineAt)})
                      </span>
                    </div>
                    <ul className="mt-1 flex flex-wrap gap-x-3 text-sm font-medium text-amber-800">
                      {r.reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Donors in progress</h3>
        {d.donorsInProgress.length === 0 ? (
          <EmptyState title="No donor is on the way">Donors who accept your requests appear here until the hospital confirms the outcome.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {d.donorsInProgress.map((a) => {
              const s = ASSIGNMENT_STATUS[a.status];
              return (
                <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{a.donorName}</span>
                    <StatusBadge status={a.status} label={s.label} tone={s.tone} />
                    <Link to={`/hospital/requests/${a.requestId}`} className="font-mono text-brand-700 underline">
                      {a.publicCode}
                    </Link>
                    <span className="text-slate-600">({a.bloodGroup})</span>
                  </span>
                  <EtaBadge eta={a.eta} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
