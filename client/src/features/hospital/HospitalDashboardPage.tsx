import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { EtaBadge } from '../../components/ui/EtaBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useHospitalDashboard } from './api';
import { ASSIGNMENT_STATUS, requestState } from '../../lib/labels';

export function HospitalDashboardPage() {
  const q = useHospitalDashboard();

  if (q.isPending) return <LoadingState label="Loading hospital dashboard…" />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data!;
  const canCreate = d.facility.verificationStatus === 'verified';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${d.facility.name} · ${d.facility.district}`}
        title="Today’s blood requests"
        subtitle="What needs a decision now, who is on the way, and what has been fulfilled."
        meta={<DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={60_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />}
        actions={
          <>
            <Link to="/hospital/requests" className="btn-outline-light">
              All requests
            </Link>
            {canCreate ? (
              <Link to="/hospital/requests/new" className="btn-light">
                + Raise request
              </Link>
            ) : (
              <span className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold">Facility verification pending</span>
            )}
          </>
        }
      />

      {/* ── METRICS GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="To Verify" value={d.counts.awaitingVerification} alertWhenNonZero="attention" />
        <StatCard label="Duplicates" value={d.counts.duplicateReviews} alertWhenNonZero="danger" />
        <StatCard label="Due < 2h" value={d.counts.dueWithin2h} alertWhenNonZero="danger" />
        <StatCard label="Awaiting Donors" value={d.counts.awaitingDonors} />
        <StatCard label="Donors En Route" value={d.counts.donorsOnTheWay} tone={d.counts.donorsOnTheWay > 0 ? 'good' : 'neutral'} />
        <StatCard label="Active Total" value={d.counts.active} to="/hospital/requests" />
        <StatCard label="Fulfilled Today" value={d.counts.fulfilledToday} tone={d.counts.fulfilledToday > 0 ? 'good' : 'neutral'} />
      </div>

      {/* ── NEEDS ATTENTION QUEUE ────────────────────────────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Needs action right now</h2>
            {d.needsAction.length > 0 && (
              <span className="signal-dot rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-black text-white">
                {d.needsAction.length}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">Urgent verifications, close deadlines and flagged duplicates</span>
        </div>

        {d.needsAction.length === 0 ? (
          <EmptyState title="Nothing needs action right now">
            <p>All active requests are on track, verified, and within safe deadline buffers.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {d.needsAction.map((r) => {
              const state = requestState(r);
              return (
                <li key={r.id}>
                  <Link
                    to={`/hospital/requests/${r.id}`}
                    className="block rounded-xl border border-slate-200 border-l-[6px] border-l-brand-600 bg-white p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-brand-600 px-2 font-mono text-base font-black text-white shadow-sm">
                          {r.bloodGroup}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900">{r.publicCode}</span>
                        <StatusBadge status={state.label} label={state.label} tone={state.tone} />
                        <span className="text-xs font-semibold text-slate-500">
                          {r.slotsFilled}/{r.unitsRequested} slots · due {formatDateTime(r.deadlineAt)} ({relativeTime(r.deadlineAt)})
                        </span>
                      </div>
                      <span className="text-xs font-bold text-brand-700">Open Details &rarr;</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {r.reasons.map((reason) => (
                        <span key={reason} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300/60">
                          ⚠ {reason}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── DONORS IN PROGRESS ────────────────────────────────────── */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Donors on the way</h2>
            {d.donorsInProgress.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                {d.donorsInProgress.length}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">Live donor travel status toward facility</span>
        </div>

        {d.donorsInProgress.length === 0 ? (
          <EmptyState title="No donors currently on the way">
            <p>Volunteers who accept alert dispatches appear here with road-based travel estimates.</p>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Donor</th>
                  <th className="px-4 py-3 font-bold">Request</th>
                  <th className="px-4 py-3 font-bold">Blood Group</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Road Travel ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.donorsInProgress.map((a) => {
                  const s = ASSIGNMENT_STATUS[a.status];
                  return (
                    <tr key={a.assignmentId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{a.donorName}</td>
                      <td className="px-4 py-3 font-mono">
                        <Link to={`/hospital/requests/${a.requestId}`} className="text-brand-700 underline font-semibold">
                          {a.publicCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{a.bloodGroup}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} label={s.label} tone={s.tone} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EtaBadge eta={a.eta} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
