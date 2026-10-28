import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useAdminOverview } from './api';

export function OverviewPanel() {
  const q = useAdminOverview();
  if (q.isPending) return <LoadingState label="Loading admin system overview…" />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data!;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">System Overview & Operational Health</h2>
          <p className="text-xs text-slate-500">Live operational telemetry across hospitals, donor registries, and message queues</p>
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Facilities to verify" value={o.counts.pendingFacilities} to="/admin/hospitals" alertWhenNonZero="attention" />
        <StatCard label="Donors to verify" value={o.counts.unverifiedDonors} to="/admin/donors" alertWhenNonZero="attention" />
        <StatCard label="Donors under review" value={o.counts.donorsUnderReview} to="/admin/donors" alertWhenNonZero="attention" />
        <StatCard label="Suspicious reports" value={o.counts.openSuspiciousReports} to="/admin/reports" alertWhenNonZero="danger" />
        <StatCard label={`Unverified > ${o.verificationDeadlineMinutes}m`} value={o.counts.overdueVerifications} alertWhenNonZero="danger" />
        <StatCard label="No responders" value={o.counts.requestsWithoutResponders} alertWhenNonZero="danger" />
        <StatCard label="Active requests" value={o.counts.activeRequests} to="/admin/requests" />
        <StatCard label="SMS outbox queued" value={o.counts.notificationsPending} to="/admin/notifications" />
        <StatCard label="SMS delivery failed" value={o.counts.notificationsFailed} to="/admin/notifications" alertWhenNonZero="danger" />
        <StatCard label="Failed logins (24h)" value={o.counts.failedLogins24h} to="/admin/audit" alertWhenNonZero={o.counts.failedLogins24h > 20 ? 'danger' : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <span className="flex h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              Overdue Request Verifications
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Raised &gt; {o.verificationDeadlineMinutes} minutes ago and still awaiting verifier confirmation. Donors cannot be contacted until verified.
            </p>
          </div>
          {o.overdueVerifications.length === 0 ? (
            <EmptyState title="No overdue verifications">
              <p>All newly raised hospital requests have been verified or reviewed within policy limits.</p>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              {o.overdueVerifications.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 ring-1 ring-brand-700/20">
                      {r.bloodGroup}
                    </span>
                    <div>
                      <Link to={`/admin/requests/${r.id}`} className="font-mono text-sm font-bold text-slate-900 hover:text-brand-700 underline">
                        {r.publicCode}
                      </Link>
                      <span className="block text-xs font-medium text-slate-500">{r.facilityName}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <span className="block text-slate-700 font-medium">Raised {relativeTime(r.createdAt)}</span>
                    <span>Due {formatDateTime(r.deadlineAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <span className="flex h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              Requests Without Responders
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verified requests with zero accepted donors and no open alerts waiting. Requires search widening or inter-hospital blood bank transfer.
            </p>
          </div>
          {o.requestsWithoutResponders.length === 0 ? (
            <EmptyState title="No requests without responders">
              <p>Every active emergency request has assigned donors or pending response windows.</p>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
              {o.requestsWithoutResponders.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 ring-1 ring-brand-700/20">
                      {r.bloodGroup}
                    </span>
                    <div>
                      <Link to={`/admin/requests/${r.id}`} className="font-mono text-sm font-bold text-slate-900 hover:text-brand-700 underline">
                        {r.publicCode}
                      </Link>
                      <span className="block text-xs font-medium text-slate-500">{r.facilityName}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <span className="block font-semibold text-amber-900">{r.alertsSent} alert batch(es) sent</span>
                    <span>Due {formatDateTime(r.deadlineAt)} ({relativeTime(r.deadlineAt)})</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
