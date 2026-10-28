import { Outlet } from 'react-router';
import { SubNav } from '../../components/layout/SubNav';

const TABS = [
  { to: '/donor', label: 'Alerts & donations', end: true },
  { to: '/donor/profile', label: 'My profile' },
];

/** Donor area shell. */
export function DonorPage() {
  return (
    <div className="space-y-5">
      <SubNav label="Donor sections" items={TABS} />
      <Outlet />
    </div>
  );
}
