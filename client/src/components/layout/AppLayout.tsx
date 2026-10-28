import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { OfflineBanner } from './OfflineBanner';
import { ApiStatus } from './ApiStatus';
import { useLogout, useMe } from '../../features/auth/api';
import { ROLE_HOME, ROLE_LABEL } from '../../features/auth/roleHome';

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
  }`;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const logout = useLogout();
  const session = me.data;
  // Public checker for everyone; the signed-in user's own area; nothing else to dead-end in.
  const nav = [
    { to: '/check', label: 'Is this real?' },
    ...(session ? [{ to: ROLE_HOME[session.user.role], label: ROLE_LABEL[session.user.role] }] : []),
  ];
  const onLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) });
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    // Close the mobile menu after navigating.
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <OfflineBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
              <path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3z" className="fill-brand-600" />
            </svg>
            Golden Hour
          </NavLink>
          <button
            type="button"
            className="btn-secondary md:hidden"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
          <nav aria-label="Primary" className="hidden items-center gap-3 md:flex">
            <ul className="flex gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={navClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <SessionControls name={session?.user.name} pending={logout.isPending} onLogout={onLogout} />
          </nav>
        </div>
        {menuOpen && (
          <nav id="primary-nav" aria-label="Primary" className="border-t border-slate-200 px-4 py-2 md:hidden">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={navClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-slate-200 pt-2">
              <SessionControls name={session?.user.name} pending={logout.isPending} onLogout={onLogout} />
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <ApiStatus />
          <p className="text-xs text-slate-500">
            Not an emergency dispatch service. No medical eligibility decisions are made by this system.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SessionControls({ name, pending, onLogout }: { name?: string; pending: boolean; onLogout: () => void }) {
  if (!name) {
    return (
      <NavLink to="/login" className="btn-secondary">
        Sign in
      </NavLink>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">{name}</span>
      <button type="button" className="btn-secondary" onClick={onLogout} disabled={pending}>
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
