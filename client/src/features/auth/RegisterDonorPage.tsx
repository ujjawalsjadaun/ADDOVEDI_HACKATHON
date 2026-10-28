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
    <div className="mx-auto max-w-xl py-6 sm:py-10">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
          Volunteer Community Network
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Register as a blood donor</h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
          Hospitals in your district alert you only when your specific blood group is needed on reachable routes. Every new donor is verified by an administrator before any alert is dispatched.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card mt-8 space-y-6 rounded-2xl p-6 sm:p-8 shadow-sm" noValidate>
        <FormError error={err} />

        <div className="space-y-4">
          <TextField
            label="Full name"
            required
            placeholder="Dr. / Mr. / Ms. Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={fieldError(err, 'name')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={fieldError(err, 'email')}
            />
            <TextField
              label="Mobile phone number"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+919000000001"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              error={fieldError(err, 'phone')}
              hint="Indian mobile (+91 format)"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Account Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 10 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={fieldError(err, 'password')}
              hint="Minimum 10 characters"
            />
            <SelectField
              label="Blood group"
              value={form.bloodGroup}
              onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as BloodGroup })}
              options={BLOOD_GROUPS.map((g) => ({ value: g, label: `${g} Blood Type` }))}
            />
          </div>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5">
          <legend className="flex items-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-brand-600" aria-hidden="true">
              <path fillRule="evenodd" d="M8 1.75c-1.35 0-2.438.45-3.21 1.055-.77.604-1.29 1.44-1.29 2.445v2.247c0 2.228 1.135 4.316 3.018 5.54a2.25 2.25 0 0 0 2.464 0c1.883-1.224 3.018-3.312 3.018-5.54V5.25c0-1.005-.52-1.84-1.29-2.445C10.438 2.2 9.35 1.75 8 1.75Z" clipRule="evenodd" />
            </svg>
            Consent & Privacy Agreement
          </legend>

          <CheckboxField
            label="Emergency Contact Consent"
            hint="Required. I agree to receive urgent SMS & in-app alerts from verified hospitals when blood is needed. I can toggle availability or pause at any time."
            checked={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.checked })}
          />
          {fieldError(err, 'consent.contact') && (
            <p className="text-xs font-semibold text-rose-600">{fieldError(err, 'consent.contact')}</p>
          )}

          <CheckboxField
            label="Approximate Locality Estimation"
            hint="I agree to share my village or neighborhood centroid (~1 km) solely to compute road travel time. Exact GPS coordinates are never stored or shared."
            checked={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.checked })}
          />
        </fieldset>

        <button type="submit" className="btn-primary w-full h-11 text-base shadow-xs" disabled={register.isPending}>
          {register.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Registering Profile…
            </span>
          ) : (
            'Complete Donor Registration'
          )}
        </button>

        <div className="text-center text-sm text-slate-600 border-t border-slate-100 pt-4">
          Already registered as a donor or clinician?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800 underline">
            Sign in here
          </Link>
        </div>
      </form>
    </div>
  );
}
