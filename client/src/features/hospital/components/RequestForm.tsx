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
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <FormError error={err} />
      {notice}

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
        <div>
          <p className="block text-sm font-medium text-slate-800">Suggested urgency</p>
          <div className="mt-2">
            {suggested ? (
              <StatusBadge status={suggested} label={URGENCY_LABEL[suggested]} tone={URGENCY_TONE[suggested]} />
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">From the deadline only. The verifier confirms the actual urgency.</p>
        </div>
      </div>

      <CheckboxField
        label="Also accept donors with compatible (not identical) blood groups"
        hint="Clinical decision for your team. When unticked, only exact-match donors are contacted."
        checked={form.acceptCompatibleGroups}
        onChange={(e) => update('acceptCompatibleGroups', e.target.checked)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Patient reference (MRN / IP number)"
          required
          autoComplete="off"
          value={form.patientRef}
          onChange={(e) => update('patientRef', e.target.value)}
          error={fe('patientRef')}
          hint="Used only to prevent duplicate requests. Stored as a one-way hash — never shown again."
        />
        <TextField
          label="Short label for staff (optional)"
          maxLength={60}
          placeholder="e.g. Ward 3, bed 12"
          value={form.patientLabel}
          onChange={(e) => update('patientLabel', e.target.value)}
          error={fe('patientLabel')}
          hint="Do not enter the patient's name."
        />
      </div>
      <TextAreaField
        label="Note for staff (optional)"
        maxLength={280}
        value={form.clinicalNote}
        onChange={(e) => update('clinicalNote', e.target.value)}
        error={fe('clinicalNote')}
        hint="Visible to your facility's staff only. Never included in donor alerts."
      />

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Submitting…' : submitLabel}
        </button>
        {secondaryAction}
      </div>
    </form>
  );
}
