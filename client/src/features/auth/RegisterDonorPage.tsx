import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BLOOD_GROUPS, type BloodGroup, type MeResponse, type RegisterDonorInput } from '@golden-hour/shared';
import { CheckboxField, fieldError, FormError, SelectField, TextField } from '../../components/ui/form';
import { LoadingState } from '../../components/ui/states';
import { api } from '../../lib/api/client';
import { ME_QUERY_KEY, useMe } from './api';

export function RegisterDonorPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const register = useMutation({
    mutationFn: async (input: RegisterDonorInput) => (await api<MeResponse>('/auth/register-donor', { method: 'POST', body: input })).data,
    onSuccess: (session) => {
      queryClient.setQueryData(ME_QUERY_KEY, session);
      navigate('/donor/profile', { replace: true, state: { welcome: true } });
    },
  });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    bloodGroup: 'O+' as BloodGroup,
    contact: false,
    location: false,
  });

  if (me.isPending) return <LoadingState />;
  if (me.data) return <Navigate to="/" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    register.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      bloodGroup: form.bloodGroup,
      consent: { contact: form.contact as true, location: form.location },
    });
  }

  const err = register.error;
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Register as a blood donor</h1>
      <p className="mt-1 text-sm text-slate-600">
        Hospitals in your area can alert you when your blood group is needed nearby. An administrator verifies new donors before any alert
        is sent. Registering is not a medical check — the hospital decides whether you can donate.
      </p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4" noValidate>
        <FormError error={err} />
        <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(err, 'name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={fieldError(err, 'email')}
          />
          <TextField
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            required
            placeholder="+919000000001"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            error={fieldError(err, 'phone')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={fieldError(err, 'password')}
            hint="At least 10 characters"
          />
          <SelectField
            label="Blood group"
            value={form.bloodGroup}
            onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as BloodGroup })}
            options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
          />
        </div>
        <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Consent</legend>
          <CheckboxField
            label="I agree to be contacted by registered hospitals when my blood group is needed."
            hint="Required. You can mark yourself unavailable or withdraw at any time."
            checked={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.checked })}
          />
          {fieldError(err, 'consent.contact') && <p className="text-xs font-medium text-red-700">{fieldError(err, 'consent.contact')}</p>}
          <CheckboxField
            label="I agree to share my approximate location (village/locality, about 1 km) to estimate travel time."
            hint="Never shown to the public. Without it you will not be alerted automatically."
            checked={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.checked })}
          />
        </fieldset>
        <button type="submit" className="btn-primary w-full" disabled={register.isPending}>
          {register.isPending ? 'Registering…' : 'Register'}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand-700 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
