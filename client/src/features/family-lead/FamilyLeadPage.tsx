import { useState, type FormEvent } from 'react';
import { BLOOD_GROUPS, type BloodGroup } from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { newIdempotencyKey } from '../../lib/idempotency';
import { usePublicFacilities, useSubmitFamilyLead } from './api';

/**
 * Public form for families. A lead asks the chosen hospital blood bank to call back —
 * it does not broadcast contact details or alert donors directly without clinical triage.
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
      <div className="mx-auto max-w-lg space-y-6 py-8 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div role="status" className="rounded-2xl border border-emerald-300/80 bg-emerald-50/90 p-6 sm:p-8 text-emerald-950 shadow-xs space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
            Callback Request Submitted
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Sent to {submit.data.facilityName}</h1>
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-black/5 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Tracking Reference</span>
            <p className="font-mono text-xl font-extrabold text-slate-900 tracking-wider">{submit.data.reference}</p>
          </div>
          <p className="text-sm leading-relaxed">
            Hospital blood bank staff have received this request and will call you on the number provided.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 leading-relaxed font-medium">
            <strong>Important Note:</strong> This is a family assistance lead. Official donor alerts will only be mobilized once the hospital verifies clinical necessity and confirms the patient record.
          </div>
        </div>
        <p className="text-center text-xs text-slate-500">
          In an immediate medical emergency, please contact the facility directly or call 108.
        </p>
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
    <div className="mx-auto max-w-xl py-6 sm:py-10">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
          <span className="flex h-1.5 w-1.5 rounded-full bg-rose-600" aria-hidden="true" />
          Family Support Desk
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Ask a hospital for blood</h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
          For family members of hospitalized patients. Your request routes directly to the facility's blood bank for callback triage — keeping your phone number secure and avoiding unverified broadcast panic.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card mt-8 space-y-5 rounded-2xl p-6 sm:p-8 shadow-sm" noValidate>
        <FormError error={err} />

        <SelectField
          label="Treating Hospital Facility"
          required
          value={form.hospitalId}
          onChange={(e) => set('hospitalId', e.target.value)}
          options={[
            { value: '', label: facilities.isPending ? 'Loading registered hospitals…' : 'Select a registered hospital' },
            ...(facilities.data ?? []).map((f) => ({ value: f.id, label: `${f.name} — ${f.district}` })),
          ]}
          error={fieldError(err, 'hospitalId')}
          hint="Only verified hospitals registered on Golden Hour are shown."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Your Full Name"
            required
            placeholder="Attendant / Family Name"
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            error={fieldError(err, 'contactName')}
          />
          <TextField
            label="Your Contact Mobile"
            type="tel"
            required
            placeholder="+919000000001"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            error={fieldError(err, 'contactPhone')}
            hint="Strictly private; shared only with hospital staff."
          />
        </div>

        <SelectField
          label="Patient Blood Group (if confirmed)"
          value={form.bloodGroup}
          onChange={(e) => set('bloodGroup', e.target.value as BloodGroup | '')}
          options={[{ value: '', label: "Unknown / To be tested by hospital" }, ...BLOOD_GROUPS.map((g) => ({ value: g, label: `${g} Blood Type` }))]}
        />

        <TextAreaField
          label="Ward / Bed / Department (optional)"
          maxLength={280}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          hint="Example: ICU Bed 4, Dr. Tenzing. Please avoid clinical diagnostic details."
          placeholder="Enter room number or attending physician name…"
        />

        <button type="submit" className="btn-primary w-full h-11 text-base shadow-xs" disabled={submit.isPending}>
          {submit.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Transmitting to Hospital…
            </span>
          ) : (
            'Send Request to Hospital Blood Bank'
          )}
        </button>
      </form>
    </div>
  );
}
