import { useState, type FormEvent } from 'react';
import { URGENCY_LEVELS, type RequestAction, type RequestDetail, type Urgency } from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../../components/ui/form';
import { ReasonForm } from '../../../components/ui/ReasonForm';
import { useRequestAction } from '../api';
import { URGENCY_LABEL } from '../../../lib/labels';

const BUTTONS: { action: RequestAction; label: string; danger?: boolean; primary?: boolean }[] = [
  { action: 'verify', label: 'Verify request', primary: true },
  { action: 'review_duplicate', label: 'Resolve duplicate review', primary: true },
  { action: 'fulfill', label: 'Confirm fulfilled', primary: true },
  { action: 'alert_next_batch', label: 'Alert more donors' },
  { action: 'flag_review', label: 'Place under review', danger: true },
  { action: 'clear_review', label: 'Clear review', primary: true },
  { action: 'reject', label: 'Reject', danger: true },
  { action: 'cancel', label: 'Cancel request', danger: true },
];

/** Shows only the actions the server says this user may take now (`allowedActions`); the server re-checks. */
export function RequestActions({ request }: { request: RequestDetail }) {
  const [open, setOpen] = useState<RequestAction | null>(null);
  const mutation = useRequestAction(request.id);
  const available = BUTTONS.filter((b) => request.allowedActions.includes(b.action));
  const close = () => setOpen(null);
  const start = (action: RequestAction) => {
    mutation.reset();
    setOpen(action);
  };

  if (available.length === 0) return null;

  return (
    <section className="card space-y-3.5 border-slate-200" aria-label="Actions">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Clinical Workflow Actions</h3>
          <p className="text-xs text-slate-500">Authorized role operations available for this request state</p>
        </div>
      </div>
      {!open && (
        <div className="flex flex-wrap gap-2.5 pt-1">
          {available.map((b) => (
            <button
              key={b.action}
              type="button"
              className={
                b.primary
                  ? 'btn-primary text-xs min-h-9 py-1.5'
                  : b.danger
                  ? 'btn-secondary text-xs min-h-9 py-1.5 text-rose-700 hover:text-rose-800 hover:border-rose-200 hover:bg-rose-50/60'
                  : 'btn-secondary text-xs min-h-9 py-1.5'
              }
              onClick={() => start(b.action)}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {open === 'verify' && (
        <VerifyForm
          request={request}
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onSubmit={(urgencyConfirmed) =>
            mutation.mutate({ action: 'verify', body: { expectedVersion: request.version, urgencyConfirmed } }, { onSuccess: close })
          }
        />
      )}
      {open === 'reject' && (
        <ReasonForm
          title="Reject this request? It will be closed and no donor will be contacted."
          confirmLabel="Reject"
          danger
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onConfirm={(reason) => mutation.mutate({ action: 'reject', body: { expectedVersion: request.version, reason } }, { onSuccess: close })}
        />
      )}
      {open === 'cancel' && (
        <ReasonForm
          title="Cancel this request? It will be closed. Raise a new request if blood is needed again."
          confirmLabel="Cancel request"
          danger
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onConfirm={(reason) => mutation.mutate({ action: 'cancel', body: { expectedVersion: request.version, reason } }, { onSuccess: close })}
        />
      )}
      {open === 'alert_next_batch' && (
        <ReasonForm
          title="Alert the next donors now? The usual contact cooldown is relaxed; every other filter still applies."
          confirmLabel="Alert more donors"
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onConfirm={(reason) =>
            mutation.mutate({ action: 'alerts/next-batch', body: { expectedVersion: request.version, reason } }, { onSuccess: close })
          }
        />
      )}
      {open === 'flag_review' && (
        <ReasonForm
          title="Place this request under review? The public checker will say “under review”, verification and new donor alerts pause. Donors already travelling are not cancelled."
          confirmLabel="Place under review"
          danger
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onConfirm={(reason) =>
            mutation.mutate({ action: 'review-flag', body: { expectedVersion: request.version, flagged: true, reason } }, { onSuccess: close })
          }
        />
      )}
      {open === 'clear_review' && (
        <ReasonForm
          title="Clear the review? The request returns to its normal state and alerts can resume."
          confirmLabel="Clear review"
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onConfirm={(reason) =>
            mutation.mutate({ action: 'review-flag', body: { expectedVersion: request.version, flagged: false, reason } }, { onSuccess: close })
          }
        />
      )}
      {open === 'review_duplicate' && (
        <DuplicateReviewForm
          request={request}
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onSubmit={(decision, reason, duplicateOfRequestId) =>
            mutation.mutate(
              { action: 'duplicate-review', body: { expectedVersion: request.version, decision, reason, duplicateOfRequestId } },
              { onSuccess: close },
            )
          }
        />
      )}
      {open === 'fulfill' && (
        <FulfillForm
          request={request}
          pending={mutation.isPending}
          error={mutation.error}
          onCancel={close}
          onSubmit={(unitsReceived, note) =>
            mutation.mutate({ action: 'fulfill', body: { expectedVersion: request.version, unitsReceived, note } }, { onSuccess: close })
          }
        />
      )}
    </section>
  );
}

interface SubFormProps {
  request: RequestDetail;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
}

function FormButtons({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
      <button type="button" className="btn-secondary" disabled={pending} onClick={onCancel}>
        Back
      </button>
    </div>
  );
}

function VerifyForm({ request, pending, error, onCancel, onSubmit }: SubFormProps & { onSubmit: (u: Urgency) => void }) {
  const [urgency, setUrgency] = useState<Urgency>(request.urgencySuggested);
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(urgency);
      }}
    >
      <p className="text-sm text-slate-700">
        Confirm that this is a genuine need at your facility. Verifying makes the request active and visible as genuine on the public
        checker; donor alerts start from this point.
      </p>
      <FormError error={error} />
      <SelectField
        label="Confirmed urgency"
        value={urgency}
        onChange={(e) => setUrgency(e.target.value as Urgency)}
        options={URGENCY_LEVELS.map((u) => ({
          value: u,
          label: `${URGENCY_LABEL[u]}${u === request.urgencySuggested ? ' (suggested from deadline)' : ''}`,
        }))}
        error={fieldError(error, 'urgencyConfirmed')}
      />
      <FormButtons pending={pending} label="Verify" onCancel={onCancel} />
    </form>
  );
}

function DuplicateReviewForm({
  request,
  pending,
  error,
  onCancel,
  onSubmit,
}: SubFormProps & { onSubmit: (decision: 'distinct' | 'duplicate', reason: string, duplicateOf?: string) => void }) {
  const [decision, setDecision] = useState<'distinct' | 'duplicate'>('distinct');
  const [duplicateOf, setDuplicateOf] = useState(request.duplicateReview.candidates[0]?.id ?? '');
  const [reason, setReason] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(decision, reason, decision === 'duplicate' ? duplicateOf : undefined);
      }}
    >
      <p className="text-sm text-slate-700">
        A similar active request exists. Decide whether this is a separate need. A possible duplicate is never closed automatically.
      </p>
      <FormError error={error} />
      <SelectField
        label="Decision"
        value={decision}
        onChange={(e) => setDecision(e.target.value as 'distinct' | 'duplicate')}
        options={[
          { value: 'distinct', label: 'Separate need — keep this request' },
          { value: 'duplicate', label: 'Duplicate — close this request' },
        ]}
      />
      {decision === 'duplicate' && (
        <SelectField
          label="Duplicate of"
          value={duplicateOf}
          onChange={(e) => setDuplicateOf(e.target.value)}
          options={request.duplicateReview.candidates.map((c) => ({
            value: c.id,
            label: `${c.publicCode} · ${c.bloodGroup}${c.patientLabel ? ` · ${c.patientLabel}` : ''}`,
          }))}
          error={fieldError(error, 'duplicateOfRequestId')}
        />
      )}
      <TextAreaField
        label="Reason (recorded in the audit log)"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={fieldError(error, 'reason')}
      />
      <FormButtons pending={pending} label="Save decision" onCancel={onCancel} />
    </form>
  );
}

function FulfillForm({ request, pending, error, onCancel, onSubmit }: SubFormProps & { onSubmit: (units: number, note?: string) => void }) {
  const [units, setUnits] = useState(String(request.unitsRequested));
  const [note, setNote] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(Number(units), note || undefined);
      }}
    >
      <p className="text-sm text-slate-700">
        Confirm the patient's need was met. This closes the request; the public checker will show it as fulfilled.
      </p>
      <FormError error={error} />
      <TextField
        label="Units received"
        type="number"
        min={1}
        max={request.unitsRequested}
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        error={fieldError(error, 'unitsReceived')}
      />
      <TextAreaField label="Note (optional)" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormButtons pending={pending} label="Confirm fulfilled" onCancel={onCancel} />
    </form>
  );
}
