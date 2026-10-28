import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'requests', label: 'Requests' },
  { to: 'hospitals', label: 'Facilities' },
  { to: 'users', label: 'Staff accounts' },
  { to: 'donors', label: 'Donors' },
  { to: 'reports', label: 'Reports' },
  { to: 'audit', label: 'Audit log' },
];

/** Admin area shell; panels render in the outlet. */
export function AdminPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-slate-600">Every decision here requires a reason and is recorded in the audit log.</p>
      </div>
      <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4">
        <ul className="-mb-px flex gap-4 whitespace-nowrap">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
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
