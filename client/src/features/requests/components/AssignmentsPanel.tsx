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
    <section className="card space-y-4 border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Donors &amp; Dispatch</h3>
          <p className="text-xs text-slate-500">Live responder assignments and automated outbox telemetry</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800">
          {request.slotsFilled} / {request.unitsRequested} slot{request.unitsRequested > 1 ? 's' : ''} filled
        </span>
      </div>

      {s.total > 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Alerts dispatched: <strong className="text-slate-900">{s.total}</strong></span>
            <span>·</span>
            <span className="text-amber-700 font-medium">waiting {s.pending}</span>
            <span>·</span>
            <span className="text-emerald-700 font-medium">accepted {s.accepted}</span>
            <span>·</span>
            <span className="text-slate-500 font-medium">declined {s.declined}</span>
            <span>·</span>
            <span className="text-slate-500 font-medium">expired {s.expired}</span>
            {s.cancelled > 0 && (
              <>
                <span>·</span>
                <span className="text-slate-400 font-medium">cancelled {s.cancelled}</span>
              </>
            )}
            {s.lastBatchAt && (
              <>
                <span>·</span>
                <span className="text-slate-500 font-normal">last batch {formatDateTime(s.lastBatchAt)}</span>
              </>
            )}
          </div>
          <p className="text-2xs text-slate-500 leading-normal">
            SMS copies: <span className="font-medium text-slate-700">{smsSummary(s.sms)}</span>. “Sent” indicates delivery carrier accepted the packet, not donor optical receipt.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          {request.verificationStatus === 'verified' ? 'No donors have been alerted yet.' : 'Donors are alerted automatically following clinical verification.'}
        </p>
      )}

      {request.assignments.length > 0 && (
        <ul className="divide-y divide-slate-100">
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
    <li className="space-y-2.5 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{a.donor.name}</span>
          <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 border border-brand-200">
            {a.donor.bloodGroup}
          </span>
          <StatusBadge status={a.status} label={status.label} tone={status.tone} />
          {a.arrivedBy === 'donor_reported' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 border border-amber-200">
              Arrival self-reported by donor
            </span>
          )}
        </div>
        <EtaBadge eta={a.eta} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {a.donor.phone && (
          <a href={`tel:${a.donor.phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {a.donor.phone}
          </a>
        )}
        {a.donor.anchorLabel && <span>From {a.donor.anchorLabel}</span>}
        <span>·</span>
        <span>Accepted {formatDateTime(a.acceptedAt)}</span>
      </div>

      {a.endReason && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs text-slate-600 italic">
          “{a.endReason}”
        </div>
      )}
      <FormError error={action.error} />

      {!noShow && a.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {a.allowedActions.includes('confirm_arrival') && (
            <button
              type="button"
              className="btn-secondary text-xs min-h-9 py-1.5"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: 'confirm-arrival', assignmentId: a.id, body: { expectedVersion: a.version } })}
            >
              Confirm arrival
            </button>
          )}
          {a.allowedActions.includes('mark_donated') && (
            <button
              type="button"
              className="btn-primary text-xs min-h-9 py-1.5"
              disabled={action.isPending}
              onClick={() => action.mutate({ action: 'donated', assignmentId: a.id, body: { expectedVersion: a.version } })}
            >
              Donation completed
            </button>
          )}
          {a.allowedActions.includes('mark_no_show') && (
            <button type="button" className="btn-secondary text-xs min-h-9 py-1.5 text-rose-700 hover:text-rose-800" onClick={() => setNoShow(true)}>
              Did not arrive
            </button>
          )}
        </div>
      )}
      {noShow && (
        <form onSubmit={submitNoShow} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="text-xs font-medium text-rose-900">
            Records a missed donation for this donor (three within 180 days triggers admin review). Use only if they did not arrive.
          </p>
          <TextAreaField label="What happened (recorded in the audit log)" required value={reason} onChange={(e) => setReason(e.target.value)} error={fieldError(action.error, 'reason')} />
          <CheckboxField label="Blood is still needed — alert the next donors" checked={needStillExists} onChange={(e) => setNeedStillExists(e.target.checked)} />
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-danger text-xs min-h-9 py-1.5" disabled={action.isPending}>
              Record no-show
            </button>
            <button type="button" className="btn-secondary text-xs min-h-9 py-1.5" onClick={() => setNoShow(false)}>
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
