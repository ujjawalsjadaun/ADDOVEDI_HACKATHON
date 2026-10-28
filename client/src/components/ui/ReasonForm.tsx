import { useState, type FormEvent } from 'react';
import { fieldError, FormError, TextAreaField } from './form';

interface ReasonFormProps {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Inline confirmation that collects the audited reason for a sensitive decision. */
export function ReasonForm({ title, confirmLabel, danger, pending, error, onConfirm, onCancel }: ReasonFormProps) {
  const [reason, setReason] = useState('');
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(reason);
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium">{title}</p>
      <FormError error={error} />
      <TextAreaField
        label="Reason (recorded in the audit log)"
        required
        minLength={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={fieldError(error, 'reason')}
      />
      <div className="flex gap-2">
        <button type="submit" className={danger ? 'btn-primary' : 'btn-secondary'} disabled={pending}>
          {pending ? 'Saving…' : confirmLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
