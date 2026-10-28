import { useState, type FormEvent } from 'react';
import { BLOOD_GROUPS, type BloodGroup } from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { newIdempotencyKey } from '../../lib/idempotency';
import { usePublicFacilities, useSubmitFamilyLead } from './api';

/**
 * Public form for families. A lead only asks the chosen hospital to call back — it does not create an
 * official request and never contacts donors. The hospital decides.
 */
export function FamilyLeadPage() {
  const facilities = usePublicFacilities();
  const submit = useSubmitFamilyLead();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [form, setForm] = useState({ hospitalId: '', contactName: '', contactPhone: '', bloodGroup: '' as BloodGroup | '', note: '' });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setIdempotencyKey(newIdempotencyKey());
  };

  if (submit.isSuccess) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-900">
          <h1 className="text-lg font-semibold">Sent to {submit.data.facilityName}</h1>
          <p className="mt-1 text-sm">
            Reference <span className="font-mono font-semibold">{submit.data.reference}</span>. Hospital staff will call you back on the number you gave.
          </p>
          <p className="mt-2 text-sm">
            This is <strong>not</strong> an official blood request yet and no donor has been contacted. Only the hospital can raise an
            official request after checking with you.
          </p>
        </div>
        <p className="text-sm text-slate-600">In an emergency, also call the hospital or 108 directly.</p>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({
      idempotencyKey,
      input: {
        hospitalId: form.hospitalId,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        bloodGroup: form.bloodGroup || undefined,
        note: form.note || undefined,
      },
    });
  }

  const err = submit.error;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Ask a hospital for blood</h1>
      <p className="mt-1 text-sm text-slate-600">
        For family members of a patient. Your message goes to the hospital you choose; their staff will call you back. Only the hospital can
        raise an official request and contact donors.
      </p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4" noValidate>
        <FormError error={err} />
        <SelectField
          label="Hospital where the patient is"
          required
          value={form.hospitalId}
          onChange={(e) => set('hospitalId', e.target.value)}
          options={[
            { value: '', label: facilities.isPending ? 'Loading hospitals…' : 'Choose a hospital' },
            ...(facilities.data ?? []).map((f) => ({ value: f.id, label: `${f.name} (${f.district})` })),
          ]}
          error={fieldError(err, 'hospitalId')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Your name" required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} error={fieldError(err, 'contactName')} />
          <TextField
            label="Your mobile number"
            type="tel"
            required
            placeholder="+919000000001"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            error={fieldError(err, 'contactPhone')}
            hint="Shared only with the chosen hospital."
          />
        </div>
        <SelectField
          label="Patient's blood group (if known)"
          value={form.bloodGroup}
          onChange={(e) => set('bloodGroup', e.target.value as BloodGroup | '')}
          options={[{ value: '', label: "Don't know" }, ...BLOOD_GROUPS.map((g) => ({ value: g, label: g }))]}
        />
        <TextAreaField
          label="Message (optional)"
          maxLength={280}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          hint="e.g. ward or doctor's name. Please don't include medical details."
        />
        <button type="submit" className="btn-primary w-full" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Send to hospital'}
        </button>
      </form>
    </div>
  );
}
