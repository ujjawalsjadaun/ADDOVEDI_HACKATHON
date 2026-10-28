import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { OfflineBanner } from './OfflineBanner';
import { ApiStatus } from './ApiStatus';

const NAV = [
  { to: '/check', label: 'Is this real?' },
  { to: '/hospital', label: 'Hospital' },
  { to: '/donor', label: 'Donor' },
  { to: '/coordinator', label: 'Coordinator' },
  { to: '/admin', label: 'Admin' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
  }`;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
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
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={navClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {menuOpen && (
          <nav id="primary-nav" aria-label="Primary" className="border-t border-slate-200 px-4 py-2 md:hidden">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={navClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
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
