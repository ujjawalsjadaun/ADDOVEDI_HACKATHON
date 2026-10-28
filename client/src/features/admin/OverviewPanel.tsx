import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useAdminOverview } from './api';

export function OverviewPanel() {
  const q = useAdminOverview();
  if (q.isPending) return <LoadingState />;
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const o = q.data!;

  return (
    <div className="space-y-6">
      <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Facilities to verify" value={o.counts.pendingFacilities} to="/admin/hospitals" alertWhenNonZero="attention" />
        <StatCard label="Donors to verify" value={o.counts.unverifiedDonors} to="/admin/donors" alertWhenNonZero="attention" />
        <StatCard label="Donors under review" value={o.counts.donorsUnderReview} to="/admin/donors" alertWhenNonZero="attention" />
        <StatCard label="Suspicious reports" value={o.counts.openSuspiciousReports} to="/admin/reports" alertWhenNonZero="danger" />
        <StatCard label={`Unverified > ${o.verificationDeadlineMinutes} min`} value={o.counts.overdueVerifications} alertWhenNonZero="danger" />
        <StatCard label="Requests with nobody responding" value={o.counts.requestsWithoutResponders} alertWhenNonZero="danger" />
        <StatCard label="Active requests" value={o.counts.activeRequests} to="/admin/requests" />
        <StatCard label="SMS queued" value={o.counts.notificationsPending} to="/admin/notifications" />
        <StatCard label="SMS failed" value={o.counts.notificationsFailed} to="/admin/notifications" alertWhenNonZero="danger" />
        <StatCard label="Failed sign-ins (24 h)" value={o.counts.failedLogins24h} to="/admin/audit" alertWhenNonZero={o.counts.failedLogins24h > 20 ? 'danger' : undefined} />
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">Overdue verifications</h3>
        <p className="text-sm text-slate-600">
          Raised more than {o.verificationDeadlineMinutes} minutes ago and still not verified. No donor has been contacted. Call the facility on
          its registered number.
        </p>
        {o.overdueVerifications.length === 0 ? (
          <EmptyState title="None" />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {o.overdueVerifications.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <Link to={`/admin/requests/${r.id}`} className="font-mono text-brand-700 underline">
                    {r.publicCode}
                  </Link>{' '}
                  · {r.bloodGroup} · {r.facilityName}
                </span>
                <span className="text-slate-600">
                  raised {relativeTime(r.createdAt)} · due {formatDateTime(r.deadlineAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Requests with nobody responding</h3>
        <p className="text-sm text-slate-600">
          Verified, no donor has accepted, and no alert is still waiting for an answer. Consider alerting more donors, or ask the facility to use its
          blood bank or a nearby facility.
        </p>
        {o.requestsWithoutResponders.length === 0 ? (
          <EmptyState title="None" />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {o.requestsWithoutResponders.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <Link to={`/admin/requests/${r.id}`} className="font-mono text-brand-700 underline">
                    {r.publicCode}
                  </Link>{' '}
                  · {r.bloodGroup} · {r.facilityName}
                </span>
                <span className="text-slate-600">
                  {r.alertsSent} alert(s) sent · due {formatDateTime(r.deadlineAt)} ({relativeTime(r.deadlineAt)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
