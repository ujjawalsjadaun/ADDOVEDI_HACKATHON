import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { BLOOD_GROUPS, MAX_UNITS_PER_REQUEST, suggestUrgency, type BloodGroup } from '@golden-hour/shared';
import { CheckboxField, fieldError, FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiError } from '../../lib/api/client';
import { toDateTimeLocalValue } from '../../lib/format';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useCreateRequest } from './api';
import { URGENCY_LABEL, URGENCY_TONE } from '../../lib/labels';

export function NewRequestPage() {
  const navigate = useNavigate();
  const create = useCreateRequest();
  // One key per submission attempt; reused on retry so a flaky network can't create two requests.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [form, setForm] = useState({
    bloodGroup: 'O+' as BloodGroup,
    acceptCompatibleGroups: false,
    unitsRequested: '1',
    deadline: toDateTimeLocalValue(new Date(Date.now() + 4 * 3_600_000)),
    patientRef: '',
    patientLabel: '',
    clinicalNote: '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setIdempotencyKey(newIdempotencyKey()); // an edited form is a new submission
  }

  const deadlineDate = new Date(form.deadline);
  const suggested = Number.isNaN(deadlineDate.getTime()) ? null : suggestUrgency(deadlineDate);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        idempotencyKey,
        input: {
          bloodGroup: form.bloodGroup,
          acceptCompatibleGroups: form.acceptCompatibleGroups,
          unitsRequested: Number(form.unitsRequested),
          deadlineAt: Number.isNaN(deadlineDate.getTime()) ? form.deadline : deadlineDate.toISOString(),
          patientRef: form.patientRef,
          patientLabel: form.patientLabel || undefined,
          clinicalNote: form.clinicalNote || undefined,
        },
      },
      {
        onSuccess: (result) =>
          navigate(`/hospital/requests/${result.request.id}`, { state: { created: true, possibleDuplicate: result.possibleDuplicate } }),
      },
    );
  }

  const err = create.error;
  const existingId = err instanceof ApiError && err.code === 'ACTIVE_REQUEST_EXISTS' ? err.fields?.existingRequestId : undefined;

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/hospital/requests" className="text-sm text-slate-600 hover:underline">
          ← Back to requests
        </Link>
        <h2 className="mt-1 text-lg font-semibold">New blood request</h2>
        <p className="text-sm text-slate-600">
          The request stays <strong>pending</strong> until a verifier at your facility confirms it. No donor is contacted before
          verification.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4" noValidate>
        <FormError error={err} />
        {existingId && (
          <p className="text-sm">
            <Link to={`/hospital/requests/${existingId}`} className="font-medium text-brand-700 underline">
              Open the existing request
            </Link>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Patient blood group"
            value={form.bloodGroup}
            onChange={(e) => update('bloodGroup', e.target.value as BloodGroup)}
            options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
            error={fieldError(err, 'bloodGroup')}
          />
          <SelectField
            label="Units needed"
            value={form.unitsRequested}
            onChange={(e) => update('unitsRequested', e.target.value)}
            options={Array.from({ length: MAX_UNITS_PER_REQUEST }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            error={fieldError(err, 'unitsRequested')}
            hint="One donor gives one unit."
          />
          <TextField
            label="Needed by"
            type="datetime-local"
            required
            value={form.deadline}
            onChange={(e) => update('deadline', e.target.value)}
            error={fieldError(err, 'deadlineAt')}
          />
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
            error={fieldError(err, 'patientRef')}
            hint="Used only to prevent duplicate requests. Stored as a one-way hash — never shown again."
          />
          <TextField
            label="Short label for staff (optional)"
            maxLength={60}
            placeholder="e.g. Ward 3, bed 12"
            value={form.patientLabel}
            onChange={(e) => update('patientLabel', e.target.value)}
            error={fieldError(err, 'patientLabel')}
            hint="Do not enter the patient's name."
          />
        </div>
        <TextAreaField
          label="Note for staff (optional)"
          maxLength={280}
          value={form.clinicalNote}
          onChange={(e) => update('clinicalNote', e.target.value)}
          error={fieldError(err, 'clinicalNote')}
          hint="Visible to your facility's staff only. Never included in donor alerts."
        />

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Submitting…' : 'Submit for verification'}
          </button>
          <Link to="/hospital/requests" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
