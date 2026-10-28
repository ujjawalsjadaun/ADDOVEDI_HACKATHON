import { useState } from 'react';
import { Link } from 'react-router';
import type { SuspiciousReportCategory, SuspiciousReportView } from '@golden-hour/shared';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../lib/format';
import { useReviewReport, useSuspiciousReports } from './api';

const CATEGORY: Record<SuspiciousReportCategory, string> = {
  fake_request: 'Looks fake',
  wrong_details: 'Wrong details',
  harassment: 'Harassment / scam',
  other: 'Other',
};

/** Public "this looks suspicious" reports. Reviewing records the outcome; any follow-up is its own audited action. */
export function ReportsPanel() {
  const [status, setStatus] = useState<'open' | 'reviewed'>('open');
  const q = useSuspiciousReports(status);

  return (
    <section className="space-y-4">
      <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
        {(['open', 'reviewed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              status === s
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {s === 'open' ? 'Open Reports' : 'Reviewed Reports'}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.data.length === 0 ? (
        <EmptyState title={status === 'open' ? 'No open reports' : 'No reviewed reports'} />
      ) : (
        <ul className="space-y-3.5">
          {q.data!.data.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportRow({ report: r }: { report: SuspiciousReportView }) {
  const [reviewing, setReviewing] = useState(false);
  const review = useReviewReport();
  return (
    <li className="card border-slate-200 hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{r.publicCode}</span>
            <StatusBadge status={r.category} label={CATEGORY[r.category]} tone="red" />
            {r.sameReporterCount24h > 3 && <StatusBadge status="repeat" label={`${r.sameReporterCount24h} reports from same source today`} tone="amber" />}
          </div>
          <p className="text-sm text-slate-600">
            {r.request ? (
              <>
                Matches a request at {r.request.facilityName} ({r.request.bloodGroup}) — {r.request.verificationStatus},{' '}
                {r.request.requestStatus.replace('_', ' ')} ·{' '}
                <Link to={`/admin/requests/${r.request.id}`} className="text-brand-700 underline">
                  open request
                </Link>
              </>
            ) : (
              'No request has this code — someone may be circulating a fake request.'
            )}
          </p>
          {r.note && <p className="text-sm text-slate-700">“{r.note}”</p>}
          <p className="text-xs text-slate-500">
            Reported {formatDateTime(r.createdAt)}
            {r.reviewedBy && ` · reviewed by ${r.reviewedBy}`}
          </p>
        </div>
        {r.status === 'open' && !reviewing && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              review.reset();
              setReviewing(true);
            }}
          >
            Mark reviewed
          </button>
        )}
      </div>
      {reviewing && (
        <ReasonForm
          title="What did you find or do?"
          confirmLabel="Mark reviewed"
          pending={review.isPending}
          error={review.error}
          onCancel={() => setReviewing(false)}
          onConfirm={(reason) => review.mutate({ id: r.id, reason }, { onSuccess: () => setReviewing(false) })}
        />
      )}
    </li>
  );
}
