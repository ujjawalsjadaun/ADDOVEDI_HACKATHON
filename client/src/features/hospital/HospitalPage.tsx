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
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{facility.name}</h1>
                  <StatusBadge status={facility.verificationStatus} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {facility.district}
                  </span>
                  <span>·</span>
                  <span className="text-slate-700">{user?.name}</span>
                  {user?.canVerifyRequests && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                      Request Verifier
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {FACILITY_NOTICE[facility.verificationStatus] && (
            <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
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
