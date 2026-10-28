import { Outlet } from 'react-router';
import { SubNav } from '../../components/layout/SubNav';

const TABS = [
  { to: '/coordinator', label: 'Active requests', end: true },
  { to: '/coordinator/map', label: 'Map & roads' },
];

/** Coordinator area shell. */
export function CoordinatorPage() {
  return (
    <div className="space-y-5">
      <SubNav label="Coordinator sections" items={TABS} />
      <Outlet />
    </div>
  );
}
