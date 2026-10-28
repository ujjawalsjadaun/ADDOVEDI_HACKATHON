import { Outlet } from 'react-router';
import { SubNav } from '../../components/layout/SubNav';

const TABS = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/requests', label: 'Requests' },
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-slate-600">Every decision here requires a reason and is recorded in the audit log.</p>
      </div>
      <SubNav label="Admin sections" items={TABS} />
      <Outlet />
    </div>
  );
}
