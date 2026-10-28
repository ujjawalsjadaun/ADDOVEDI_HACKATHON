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
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">For registered hospital staff, donors, coordinators and administrators.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4" noValidate>
        <FormError error={login.error} />
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError(login.error, 'email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError(login.error, 'password')}
        />
        <button type="submit" className="btn-primary w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-slate-600">
          Want to donate blood?{' '}
          <Link to="/register" className="font-medium text-brand-700 underline">
            Register as a donor
          </Link>
        </p>
      </form>
    </div>
  );
}
