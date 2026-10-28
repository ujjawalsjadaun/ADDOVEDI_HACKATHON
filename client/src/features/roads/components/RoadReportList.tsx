import { useState } from 'react';
import type { RoadReportView } from '@golden-hour/shared';
import { ReasonForm } from '../../../components/ui/ReasonForm';
import { EmptyState } from '../../../components/ui/states';
import { StatusBadge, type BadgeTone } from '../../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../../lib/format';
import { useDecideRoadReport } from '../api';
import { CONDITION_LABEL } from './RoadReportForm';

export const CONDITION_TONE: Record<RoadReportView['condition'], BadgeTone> = {
  blocked: 'red',
  restricted: 'amber',
  open: 'green',
  unknown: 'slate',
};

export function RoadReportList({ reports }: { reports: RoadReportView[] }) {
  if (reports.length === 0) return <EmptyState title="No road reports">Reports from staff and coordinators appear here.</EmptyState>;
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <ReportRow key={r.id} report={r} />
      ))}
    </ul>
  );
}

function ReportRow({ report: r }: { report: RoadReportView }) {
  const [pending, setPending] = useState<'verified' | 'dismissed' | null>(null);
  const decide = useDecideRoadReport();
  return (
    <li className={`card ${r.isStale ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.label}</span>
            <StatusBadge status={r.condition} label={CONDITION_LABEL[r.condition].split(' (')[0]} tone={r.isStale ? 'slate' : CONDITION_TONE[r.condition]} />
            <StatusBadge status={r.verificationStatus} tone={r.verificationStatus === 'verified' ? 'green' : 'slate'} />
            {r.isStale && <StatusBadge status="stale" tone="slate" />}
            {r.affectsEta && <StatusBadge status="affects" label="affects travel times" tone="red" />}
          </div>
          <p className="text-xs text-slate-500">
            {r.confidence} confidence · by {r.reporter.name ?? 'unknown'} ({r.reporter.role?.replace('_', ' ')}) · {formatDateTime(r.reportedAt)} ·{' '}
            {r.isStale ? `expired ${relativeTime(r.expiresAt)}` : `current until ${formatDateTime(r.expiresAt)}`}
            {r.verifiedBy && ` · ${r.verificationStatus} by ${r.verifiedBy}`}
          </p>
          {r.note && <p className="text-sm text-slate-700">{r.note}</p>}
        </div>
        {!pending && r.allowedActions.length > 0 && (
          <div className="flex gap-2">
            {r.allowedActions.includes('verify') && (
              <button type="button" className="btn-secondary" onClick={() => setPending('verified')}>
                Verify
              </button>
            )}
            {r.allowedActions.includes('dismiss') && (
              <button type="button" className="btn-secondary text-red-700" onClick={() => setPending('dismissed')}>
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
      {pending && (
        <ReasonForm
          title={pending === 'verified' ? 'How was this confirmed?' : 'Why dismiss this report?'}
          confirmLabel={pending === 'verified' ? 'Verify' : 'Dismiss'}
          danger={pending === 'dismissed'}
          pending={decide.isPending}
          error={decide.error}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => decide.mutate({ id: r.id, decision: pending, reason }, { onSuccess: () => setPending(null) })}
        />
      )}
    </li>
  );
}
