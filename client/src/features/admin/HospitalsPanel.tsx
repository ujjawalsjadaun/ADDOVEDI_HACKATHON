import { useState, type FormEvent } from 'react';
import {
  FACILITY_TYPES,
  type FacilityType,
  type HospitalAdmin,
  type HospitalVerificationStatus,
} from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextField } from '../../components/ui/form';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAdminHospitals, useCreateHospital, useHospitalDecision } from './api';

type Decision = 'verified' | 'rejected' | 'suspended';

/** Mirrors the server's transition table (docs/state-machines.md §1); the server re-checks. */
const ACTIONS: Record<HospitalVerificationStatus, { decision: Decision; label: string; danger?: boolean }[]> = {
  pending: [
    { decision: 'verified', label: 'Verify' },
    { decision: 'rejected', label: 'Reject', danger: true },
  ],
  verified: [{ decision: 'suspended', label: 'Suspend', danger: true }],
  suspended: [{ decision: 'verified', label: 'Reinstate' }],
  rejected: [],
};

const FILTERS: { value: HospitalVerificationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
];

const TYPE_LABEL: Record<FacilityType, string> = {
  hospital: 'Hospital',
  blood_bank: 'Blood bank',
  hospital_with_blood_bank: 'Hospital with blood bank',
};

export function HospitalsPanel() {
  const [filter, setFilter] = useState<HospitalVerificationStatus | ''>('pending');
  const [showCreate, setShowCreate] = useState(false);
  const hospitals = useAdminHospitals({ verificationStatus: filter || undefined, limit: 50 });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-sm ${
                filter === f.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate((s) => !s)} aria-expanded={showCreate}>
          {showCreate ? 'Close form' : 'Add facility'}
        </button>
      </div>

      {showCreate && <CreateHospitalForm onDone={() => setShowCreate(false)} />}

      {hospitals.isPending ? (
        <LoadingState />
      ) : hospitals.isError ? (
        <ErrorState error={hospitals.error} onRetry={() => void hospitals.refetch()} />
      ) : hospitals.data.data.length === 0 ? (
        <EmptyState title="No facilities here">
          {filter ? `There are no ${filter} facilities.` : 'Add the first facility to get started.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {hospitals.data.data.map((h) => (
            <HospitalRow key={h.id} hospital={h} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HospitalRow({ hospital }: { hospital: HospitalAdmin }) {
  const [pending, setPending] = useState<Decision | null>(null);
  const decide = useHospitalDecision();
  const action = ACTIONS[hospital.verificationStatus].find((a) => a.decision === pending);

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{hospital.name}</h3>
            <StatusBadge status={hospital.verificationStatus} />
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {TYPE_LABEL[hospital.facilityType]} · {hospital.district} · {hospital.staffCount} staff
          </p>
          <p className="text-sm text-slate-600">{hospital.address}</p>
          <p className="text-xs text-slate-500">Registered contact: {hospital.registeredPhone}</p>
          {hospital.verification && (
            <p className="mt-1 text-xs text-slate-500">
              Last decision {new Date(hospital.verification.at).toLocaleString()}: “{hospital.verification.reason}”
            </p>
          )}
        </div>
        {!pending && (
          <div className="flex gap-2">
            {ACTIONS[hospital.verificationStatus].map((a) => (
              <button
                key={a.decision}
                type="button"
                className={a.danger ? 'btn-secondary text-red-700' : 'btn-secondary'}
                onClick={() => {
                  decide.reset();
                  setPending(a.decision);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {action && (
        <ReasonForm
          title={`${action.label} ${hospital.name}?`}
          confirmLabel={action.label}
          danger={action.danger}
          pending={decide.isPending}
          error={decide.error}
          onCancel={() => setPending(null)}
          onConfirm={(reason) =>
            decide.mutate({ id: hospital.id, decision: action.decision, reason }, { onSuccess: () => setPending(null) })
          }
        />
      )}
    </li>
  );
}

function CreateHospitalForm({ onDone }: { onDone: () => void }) {
  const create = useCreateHospital();
  const [form, setForm] = useState({
    name: '',
    facilityType: 'hospital' as FacilityType,
    district: '',
    address: '',
    lat: '',
    lng: '',
    registeredPhone: '',
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name: form.name,
        facilityType: form.facilityType,
        district: form.district,
        address: form.address,
        location: { lat: Number(form.lat), lng: Number(form.lng) },
        registeredPhone: form.registeredPhone,
      },
      { onSuccess: onDone },
    );
  }

  const err = create.error;
  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="font-semibold">New facility</h2>
      <p className="text-sm text-slate-600">New facilities start as pending and cannot raise requests until verified.</p>
      <FormError error={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" required value={form.name} onChange={set('name')} error={fieldError(err, 'name')} />
        <SelectField
          label="Type"
          value={form.facilityType}
          onChange={set('facilityType')}
          options={FACILITY_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />
        <TextField label="District" required value={form.district} onChange={set('district')} error={fieldError(err, 'district')} />
        <TextField
          label="Registered phone"
          required
          placeholder="+919000000001"
          value={form.registeredPhone}
          onChange={set('registeredPhone')}
          error={fieldError(err, 'registeredPhone')}
        />
        <div className="sm:col-span-2">
          <TextField label="Address" required value={form.address} onChange={set('address')} error={fieldError(err, 'address')} />
        </div>
        <TextField
          label="Latitude"
          inputMode="decimal"
          required
          value={form.lat}
          onChange={set('lat')}
          error={fieldError(err, 'location.lat')}
          hint="e.g. 28.0667"
        />
        <TextField
          label="Longitude"
          inputMode="decimal"
          required
          value={form.lng}
          onChange={set('lng')}
          error={fieldError(err, 'location.lng')}
          hint="e.g. 95.3260"
        />
      </div>
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Create facility'}
      </button>
    </form>
  );
}
