import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/donor', label: 'Alerts & donations', end: true },
  { to: '/donor/profile', label: 'My profile', end: false },
];

/** Donor area shell. */
export function DonorPage() {
  return (
    <div className="space-y-5">
      <nav aria-label="Donor sections" className="border-b border-slate-200">
        <ul className="-mb-px flex gap-4">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-block border-b-2 px-1 pb-2 text-sm font-medium ${
                    isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
