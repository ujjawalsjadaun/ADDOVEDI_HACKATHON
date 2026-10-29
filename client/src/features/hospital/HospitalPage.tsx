import { Outlet } from 'react-router';
import { SubNav } from '../../components/layout/SubNav';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMe } from '../auth/api';

const TABS = [
  { to: '/hospital', label: 'Dashboard', end: true },
  { to: '/hospital/requests', label: 'Requests' },
  { to: '/hospital/leads', label: 'Family leads' },
  { to: '/hospital/transfers', label: 'Stock transfers' },
  { to: '/hospital/map', label: 'Map & roads' },
];

const FACILITY_NOTICE: Record<string, string> = {
  pending: 'Your facility is waiting for an administrator to verify it. Requests cannot be raised until then.',
  suspended: 'Your facility is suspended. Requests cannot be raised or verified. Contact the Golden Hour administrator.',
  rejected: 'Your facility registration was rejected. Contact the Golden Hour administrator.',
};

/** Hospital area shell: facility status, then the current page. */
export function HospitalPage() {
  const me = useMe();
  const facility = me.data?.facility;
  const user = me.data?.user;

  return (
    <div className="space-y-6">
      {facility && (
        <section aria-label="Your facility" className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-xs">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 6v12M6 12h12" />
              </svg>
            </span>
            <span className="font-extrabold text-slate-900">{facility.name}</span>
            <StatusBadge status={facility.verificationStatus} />
            <span className="text-slate-500">{facility.district}</span>
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="font-medium text-slate-700">{user?.name}</span>
            {user?.canVerifyRequests && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">Verifier</span>
            )}
          </div>
          {FACILITY_NOTICE[facility.verificationStatus] && (
            <div role="status" className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              <span aria-hidden="true">⚠</span>
              <span>{FACILITY_NOTICE[facility.verificationStatus]}</span>
            </div>
          )}
        </section>
      )}
      <SubNav label="Hospital sections" items={TABS} />
      <Outlet />
    </div>
  );
}
