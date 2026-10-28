import { useState, type FormEvent } from 'react';
import { PROVISIONABLE_ROLES, type UserAdmin, type UserRole, type UserStatus } from '@golden-hour/shared';
import { CheckboxField, fieldError, FormError, SelectField, TextField } from '../../components/ui/form';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMe } from '../auth/api';
import { ROLE_LABEL } from '../auth/roleHome';
import { useAdminHospitals, useAdminUsers, useCreateUser, useUserStatus } from './api';

const ROLE_FILTERS: { value: UserRole | ''; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'hospital_staff', label: 'Hospital staff' },
  { value: 'coordinator', label: 'Coordinators' },
  { value: 'admin', label: 'Admins' },
  { value: 'donor', label: 'Donors' },
];

const STATUS_ACTIONS: Record<UserStatus, { status: UserStatus; label: string; danger?: boolean }[]> = {
  active: [
    { status: 'paused', label: 'Pause' },
    { status: 'suspended', label: 'Suspend', danger: true },
  ],
  paused: [
    { status: 'active', label: 'Reactivate' },
    { status: 'suspended', label: 'Suspend', danger: true },
  ],
  suspended: [{ status: 'active', label: 'Reactivate' }],
};

export function UsersPanel() {
  const [role, setRole] = useState<UserRole | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const users = useAdminUsers({ role: role || undefined, limit: 50 });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-52">
          <SelectField
            label="Role Filter"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole | '')}
            options={ROLE_FILTERS.map((r) => ({ value: r.value, label: r.label }))}
          />
        </div>
        <button type="button" className="btn-primary text-xs min-h-9 py-1.5" onClick={() => setShowCreate((s) => !s)} aria-expanded={showCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showCreate ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          {showCreate ? 'Close form' : 'Add staff account'}
        </button>
      </div>

      {showCreate && <CreateUserForm onDone={() => setShowCreate(false)} />}

      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.data.length === 0 ? (
        <EmptyState title="No accounts">No accounts match this filter.</EmptyState>
      ) : (
        <ul className="space-y-3.5">
          {users.data.data.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UserRow({ user }: { user: UserAdmin }) {
  const me = useMe();
  const [pending, setPending] = useState<UserStatus | null>(null);
  const change = useUserStatus();
  const isSelf = me.data?.user.id === user.id;
  const action = STATUS_ACTIONS[user.status].find((a) => a.status === pending);

  return (
    <li className="card border-slate-200 hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
            <StatusBadge status={user.status} />
            {isSelf && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                Current Session
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-medium">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700">
              {ROLE_LABEL[user.role]}
            </span>
            {user.facilityName && (
              <>
                <span>·</span>
                <span>{user.facilityName}</span>
              </>
            )}
            {user.canVerifyRequests && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                Verifier
              </span>
            )}
          </div>
          <p className="text-2xs text-slate-400">
            {user.email}
            {user.phoneMasked && ` · ${user.phoneMasked}`} · Last sign-in:{' '}
            <strong className="text-slate-600">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'never'}</strong>
          </p>
        </div>
        {!pending && !isSelf && (
          <div className="flex gap-2">
            {STATUS_ACTIONS[user.status].map((a) => (
              <button
                key={a.status}
                type="button"
                className={a.danger ? 'btn-secondary text-red-700' : 'btn-secondary'}
                onClick={() => {
                  change.reset();
                  setPending(a.status);
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
          title={`${action.label} ${user.name}? ${action.status === 'active' ? '' : 'They will be signed out everywhere.'}`}
          confirmLabel={action.label}
          danger={action.danger}
          pending={change.isPending}
          error={change.error}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => change.mutate({ id: user.id, status: action.status, reason }, { onSuccess: () => setPending(null) })}
        />
      )}
    </li>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const create = useCreateUser();
  const hospitals = useAdminHospitals({ limit: 100 });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'hospital_staff' as (typeof PROVISIONABLE_ROLES)[number],
    facilityId: '',
    canVerifyRequests: false,
  });
  const isStaff = form.role === 'hospital_staff';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        role: form.role,
        facilityId: isStaff ? form.facilityId || undefined : undefined,
        canVerifyRequests: isStaff && form.canVerifyRequests,
      },
      { onSuccess: onDone },
    );
  }

  const err = create.error;
  const facilityOptions = [
    { value: '', label: hospitals.isPending ? 'Loading facilities…' : 'Select a facility' },
    ...(hospitals.data?.data ?? []).map((h) => ({ value: h.id, label: `${h.name} (${h.verificationStatus})` })),
  ];

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="font-semibold">New staff account</h2>
      <p className="text-sm text-slate-600">
        Share the initial password with the person through a trusted channel. Donors register themselves.
      </p>
      <FormError error={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(err, 'name')} />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="off"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={fieldError(err, 'email')}
        />
        <TextField
          label="Initial password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={fieldError(err, 'password')}
          hint="At least 10 characters"
        />
        <TextField
          label="Phone (optional)"
          placeholder="+919000000001"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={fieldError(err, 'phone')}
        />
        <SelectField
          label="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as (typeof PROVISIONABLE_ROLES)[number] })}
          options={PROVISIONABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        {isStaff && (
          <SelectField
            label="Facility"
            required
            value={form.facilityId}
            onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
            options={facilityOptions}
            error={fieldError(err, 'facilityId')}
          />
        )}
      </div>
      {isStaff && (
        <CheckboxField
          label="Can verify blood requests"
          hint="Verifiers confirm that a request is genuine before any donor is alerted. By default a verifier cannot verify a request they created."
          checked={form.canVerifyRequests}
          onChange={(e) => setForm({ ...form, canVerifyRequests: e.target.checked })}
        />
      )}
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Create account'}
      </button>
    </form>
  );
}
