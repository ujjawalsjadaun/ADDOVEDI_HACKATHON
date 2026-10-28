import { useState, type FormEvent, type ReactNode } from 'react';
import { BLOOD_GROUPS, MAX_UNITS_PER_REQUEST, suggestUrgency, type BloodGroup, type CreateRequestInput } from '@golden-hour/shared';
import { CheckboxField, fieldError, FormError, SelectField, TextAreaField, TextField } from '../../../components/ui/form';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { toDateTimeLocalValue } from '../../../lib/format';
import { URGENCY_LABEL, URGENCY_TONE } from '../../../lib/labels';

interface RequestFormProps {
  initialBloodGroup?: BloodGroup | null;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  onSubmit: (input: CreateRequestInput) => void;
  /** Called on every edit (an edited form is a new submission → new idempotency key). */
  onEdit?: () => void;
  /** Extra content above the fields (e.g. a link to an existing request). */
  notice?: ReactNode;
  secondaryAction?: ReactNode;
}

/** The official blood-request form, shared by "New request" and "Confirm family lead". */
export function RequestForm({ initialBloodGroup, pending, error: err, submitLabel, onSubmit, onEdit, notice, secondaryAction }: RequestFormProps) {
  const [form, setForm] = useState({
    bloodGroup: initialBloodGroup ?? ('O+' as BloodGroup),
    acceptCompatibleGroups: false,
    unitsRequested: '1',
    deadline: toDateTimeLocalValue(new Date(Date.now() + 4 * 3_600_000)),
    patientRef: '',
    patientLabel: '',
    clinicalNote: '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    onEdit?.();
  }

  const deadlineDate = new Date(form.deadline);
  const suggested = Number.isNaN(deadlineDate.getTime()) ? null : suggestUrgency(deadlineDate);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      bloodGroup: form.bloodGroup,
      acceptCompatibleGroups: form.acceptCompatibleGroups,
      unitsRequested: Number(form.unitsRequested),
      deadlineAt: Number.isNaN(deadlineDate.getTime()) ? form.deadline : deadlineDate.toISOString(),
      patientRef: form.patientRef,
      patientLabel: form.patientLabel || undefined,
      clinicalNote: form.clinicalNote || undefined,
    });
  }

  // Fields of a nested `request` object (family-lead confirmation) are reported as `request.<field>`.
  const fe = (field: string) => fieldError(err, field) ?? fieldError(err, `request.${field}`);

  return (
    <form onSubmit={submit} className="card space-y-6 shadow-sm border-slate-200" noValidate>
      <FormError error={err} />
      {notice}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">1. Clinical Requirements</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Patient blood group"
            value={form.bloodGroup}
            onChange={(e) => update('bloodGroup', e.target.value as BloodGroup)}
            options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
            error={fe('bloodGroup')}
          />
          <SelectField
            label="Units needed"
            value={form.unitsRequested}
            onChange={(e) => update('unitsRequested', e.target.value)}
            options={Array.from({ length: MAX_UNITS_PER_REQUEST }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            error={fe('unitsRequested')}
            hint="One donor gives one unit."
          />
          <TextField label="Needed by" type="datetime-local" required value={form.deadline} onChange={(e) => update('deadline', e.target.value)} error={fe('deadlineAt')} />
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <p className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Calculated Urgency</p>
            <div className="mt-1.5 flex items-center gap-2">
              {suggested ? (
                <StatusBadge status={suggested} label={URGENCY_LABEL[suggested]} tone={URGENCY_TONE[suggested]} />
              ) : (
                <span className="text-sm text-slate-500">—</span>
              )}
            </div>
            <p className="mt-1.5 text-2xs text-slate-500">System baseline from target deadline. The clinical verifier confirms the actual urgency level upon review.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
          <CheckboxField
            label="Also accept donors with compatible (not identical) blood groups"
            hint="Clinical decision for your facility. When unchecked, only exact-match donors will be alerted."
            checked={form.acceptCompatibleGroups}
            onChange={(e) => update('acceptCompatibleGroups', e.target.checked)}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">2. Patient & Privacy Safeguards</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Patient reference (MRN / IP number)"
            required
            autoComplete="off"
            value={form.patientRef}
            onChange={(e) => update('patientRef', e.target.value)}
            error={fe('patientRef')}
            hint="Used to prevent duplicate requests. Anonymously hashed via HMAC-SHA256 and never stored in plaintext."
          />
          <TextField
            label="Short label for staff (optional)"
            maxLength={60}
            placeholder="e.g. Ward 3, bed 12"
            value={form.patientLabel}
            onChange={(e) => update('patientLabel', e.target.value)}
            error={fe('patientLabel')}
            hint="Internal locator. Never enter the patient's actual name."
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">3. Clinical Staff Notes</h3>
        <TextAreaField
          label="Note for staff (optional)"
          maxLength={280}
          placeholder="Specific operational instructions or room details..."
          value={form.clinicalNote}
          onChange={(e) => update('clinicalNote', e.target.value)}
          error={fe('clinicalNote')}
          hint="Visible to your facility's authorized staff only. Never transmitted in external donor alerts."
        />
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? (
            <>
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Submitting…</span>
            </>
          ) : (
            submitLabel
          )}
        </button>
        {secondaryAction}
      </div>
    </form>
  );
}
