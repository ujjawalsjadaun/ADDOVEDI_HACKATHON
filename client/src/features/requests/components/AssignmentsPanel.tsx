import { useState, type FormEvent } from 'react';
import type { AssignmentForHospital, RequestDetail } from '@golden-hour/shared';
import { EtaBadge } from '../../../components/ui/EtaBadge';
import { CheckboxField, fieldError, FormError, TextAreaField } from '../../../components/ui/form';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatDateTime } from '../../../lib/format';
import { ASSIGNMENT_STATUS } from '../../../lib/labels';
import { useAssignmentAction } from '../api';

/** Donors who accepted, with the hospital's confirmations. Donation ≠ fulfilment: the request is closed separately. */
export function AssignmentsPanel({ request }: { request: RequestDetail }) {
  const s = request.alertSummary;
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Donors</h3>
        <p className="text-sm text-slate-600">
          {request.slotsFilled} of {request.unitsRequested} slot{request.unitsRequested > 1 ? 's' : ''} filled
        </p>
      </div>
      {s.total > 0 ? (
        <p className="text-sm text-slate-600">
          Alerts sent: {s.total} · waiting {s.pending} · accepted {s.accepted} · declined {s.declined} · expired {s.expired}
          {s.cancelled > 0 && ` · no longer needed ${s.cancelled}`}
          {s.lastBatchAt && ` · last batch ${formatDateTime(s.lastBatchAt)}`}
          <span className="block text-xs text-slate-500">
            SMS copies: {smsSummary(s.sms)}. “Sent” means the SMS provider accepted it — not that the donor has read it.
          </span>
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          {request.verificationStatus === 'verified' ? 'No donor has been alerted yet.' : 'Donors are alerted only after verification.'}
        </p>
      )}
      {request.assignments.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {request.assignments.map((a) => (
            <AssignmentRow key={a.id} requestId={request.id} assignment={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AssignmentRow({ requestId, assignment: a }: { requestId: string; assignment: AssignmentForHospital }) {
  const action = useAssignmentAction(requestId);
  const [noShow, setNoShow] = useState(false);
  const [reason, setReason] = useState('');
  const [needStillExists, setNeedStillExists] = useState(true);
  const status = ASSIGNMENT_STATUS[a.status];

  function submitNoShow(e: FormEvent) {
    e.preventDefault();
    action.mutate(
      { action: 'no-show', assignmentId: a.id, body: { expectedVersion: a.version, reason, needStillExists } },
      { onSuccess: () => setNoShow(false) },
    );
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{a.donor.name}</span>
        <span className="text-sm text-slate-600">({a.donor.bloodGroup})</span>
        <StatusBadge status={a.status} label={status.label} tone={status.tone} />
        {a.arrivedBy === 'donor_reported' && <span className="text-xs text-amber-700">arrival reported by donor</span>}
      </div>
      <p className="text-sm text-slate-600">
        {a.donor.phone && (
          <a href={`tel:${a.donor.phone}`} className="font-medium text-brand-700 underline">
            {a.donor.phone}
          </a>
        )}
        {a.donor.anchorLabel && ` · from ${a.donor.anchorLabel}`} · accepted {formatDateTime(a.acceptedAt)}
      </p>
      <p className="text-sm">
        <EtaBadge eta={a.eta} />
      </p>
      {a.endReason && <p className="text-sm text-slate-600">“{a.endReason}”</p>}
      <FormError error={action.error} />
      {!noShow && a.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {a.allowedActions.includes('confirm_arrival') && (
            <button
              type="button"
              className="btn-secondary"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: 'confirm-arrival', assignmentId: a.id, body: { expectedVersion: a.version } })}
            >
              Confirm arrival
            </button>
          )}
          {a.allowedActions.includes('mark_donated') && (
            <button
              type="button"
              className="btn-primary"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: 'donated', assignmentId: a.id, body: { expectedVersion: a.version } })}
            >
              Donation completed
            </button>
          )}
          {a.allowedActions.includes('mark_no_show') && (
            <button type="button" className="btn-secondary text-red-700" onClick={() => setNoShow(true)}>
              Did not arrive
            </button>
          )}
        </div>
      )}
      {noShow && (
        <form onSubmit={submitNoShow} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            Records a missed donation for this donor (three within 180 days places them under admin review). Use it only if they did not come.
          </p>
          <TextAreaField label="What happened (recorded in the audit log)" required value={reason} onChange={(e) => setReason(e.target.value)} error={fieldError(action.error, 'reason')} />
          <CheckboxField label="Blood is still needed — alert the next donors" checked={needStillExists} onChange={(e) => setNeedStillExists(e.target.checked)} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={action.isPending}>
              Record no-show
            </button>
            <button type="button" className="btn-secondary" onClick={() => setNoShow(false)}>
              Back
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function smsSummary(sms: Partial<Record<string, number>>): string {
  const parts = (
    [
      ['pending', 'queued'],
      ['sending', 'sending'],
      ['sent', 'sent'],
      ['delivered', 'delivered'],
      ['failed', 'failed'],
      ['unknown', 'unknown'],
    ] as const
  )
    .filter(([k]) => (sms[k] ?? 0) > 0)
    .map(([k, label]) => `${sms[k]} ${label}`);
  return parts.length ? parts.join(' · ') : 'none queued';
}
