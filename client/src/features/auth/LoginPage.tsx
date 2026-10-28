import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { fieldError, FormError, TextField } from '../../components/ui/form';
import { LoadingState } from '../../components/ui/states';
import { useLogin, useMe } from './api';
import { ROLE_HOME } from './roleHome';

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me.isPending) return <LoadingState />;
  if (me.data) return <Navigate to={from ?? ROLE_HOME[me.data.user.role]} replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: (session) => navigate(from ?? ROLE_HOME[session.user.role], { replace: true }) },
    );
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-500/20 shadow-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Sign in to Golden Hour</h1>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          Access your clinical dashboard, donor alerts, or administrative queue.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card mt-8 space-y-5 rounded-2xl p-6 sm:p-8 shadow-sm" noValidate>
        <FormError error={login.error} />
        <TextField
          label="Work Email or Donor Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError(login.error, 'email')}
          placeholder="doctor@hospital.org or donor@mail.com"
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError(login.error, 'password')}
          placeholder="••••••••••••"
        />
        <button type="submit" className="btn-primary w-full h-11 text-base shadow-xs" disabled={login.isPending}>
          {login.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in…
            </span>
          ) : (
            'Sign in to Dashboard'
          )}
        </button>

        <div className="pt-2 text-center text-sm text-slate-600 border-t border-slate-100">
          Want to become a volunteer donor?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800 underline">
            Register as a donor
          </Link>
        </div>
      </form>
    </div>
  );
}
