import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { OfflineBanner } from './OfflineBanner';
import { ApiStatus } from './ApiStatus';
import { LiveStatus } from './LiveStatus';
import { RealtimeProvider } from '../../lib/realtime/RealtimeProvider';
import { useLogout, useMe } from '../../features/auth/api';
import { ROLE_HOME, ROLE_LABEL } from '../../features/auth/roleHome';

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
    isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
    ...(!session || session.user.role === 'donor' ? [{ to: '/help', label: 'Ask for blood' }] : []),
    ...(session ? [{ to: ROLE_HOME[session.user.role], label: ROLE_LABEL[session.user.role] }] : []),
  ];
  const onLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) });
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <RealtimeProvider enabled={!!session}>
      <div className="flex min-h-dvh flex-col bg-slate-100/70 font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <OfflineBanner />

        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur-md">
          <div className="h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700" aria-hidden="true" />
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <NavLink to="/" className="group flex items-center gap-2.5 text-white transition-opacity hover:opacity-95">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-2 ring-brand-500/60 transition-transform duration-200 group-hover:scale-105">
                <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
                  <defs>
                    <linearGradient id="navDropGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#991b1b" />
                    </linearGradient>
                  </defs>
                  <path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3z" fill="url(#navDropGrad)" />
                  <path d="M16 7c-1.5 3-4.5 7-4.5 11a4.5 4.5 0 0 0 1 2.8" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold leading-tight tracking-tight">Golden Hour</span>
                <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-brand-300">Blood Request Network</span>
              </div>
            </NavLink>

            <button
              type="button"
              className="btn-outline-light h-9 px-3 text-xs md:hidden"
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>

            <nav aria-label="Primary" className="hidden items-center gap-4 md:flex">
              <ul className="flex items-center gap-1.5">
                {nav.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} className={navClass}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="h-5 w-px bg-white/20" aria-hidden="true" />
              <SessionControls name={session?.user.name} role={session?.user.role} pending={logout.isPending} onLogout={onLogout} />
            </nav>
          </div>

          {menuOpen && (
            <nav id="primary-nav" aria-label="Primary" className="border-t border-white/10 bg-slate-950 px-4 py-3 md:hidden">
              <ul className="flex flex-col gap-1">
                {nav.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} className={navClass}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-white/10 pt-3">
                <SessionControls name={session?.user.name} role={session?.user.role} pending={logout.isPending} onLogout={onLogout} />
              </div>
            </nav>
          )}
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Outlet />
        </main>

        <footer className="mt-auto border-t-4 border-brand-600 bg-slate-950 text-slate-300">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-300">
                <ApiStatus />
                <LiveStatus />
              </div>
              <p className="max-w-md text-xs leading-relaxed text-slate-400 sm:text-right">
                Golden Hour coordinates and verifies blood requests. It is not the 108 emergency service and makes no medical eligibility decisions
                — hospitals do.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </RealtimeProvider>
  );
}

function SessionControls({
  name,
  role,
  pending,
  onLogout,
}: {
  name?: string;
  role?: string;
  pending: boolean;
  onLogout: () => void;
}) {
  if (!name) {
    return (
      <NavLink to="/login" className="btn-light h-9 px-4 text-xs">
        Sign in
      </NavLink>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white ring-2 ring-white/30">{initial}</div>
        <div className="hidden flex-col sm:flex">
          <span className="text-xs font-semibold leading-tight text-white">{name}</span>
          {role && <span className="text-[10px] font-medium capitalize leading-none text-slate-400">{role.replace(/_/g, ' ')}</span>}
        </div>
      </div>
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        onClick={onLogout}
        disabled={pending}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
