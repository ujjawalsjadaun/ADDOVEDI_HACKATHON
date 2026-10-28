import { Outlet } from 'react-router';
import { SubNav } from '../../components/layout/SubNav';

const TABS = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/escalations', label: 'Escalations' },
  { to: '/admin/map', label: 'Map & roads' },
  { to: '/admin/hospitals', label: 'Facilities' },
  { to: '/admin/users', label: 'Staff accounts' },
  { to: '/admin/donors', label: 'Donors' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/notifications', label: 'Notifications' },
  { to: '/admin/audit', label: 'Audit log' },
];

/** Admin area shell; panels render in the outlet. */
export function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-slate-900" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Administration Console</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Audit-backed oversight: Every decision requires explicit reason logging and bumps security tokens.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-slate-500" aria-hidden="true">
            <path fillRule="evenodd" d="M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5ZM2.75 8a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" />
          </svg>
          Root Administrator
        </div>
      </div>
      <SubNav label="Admin sections" items={TABS} />
      <Outlet />
    </div>
  );
}
