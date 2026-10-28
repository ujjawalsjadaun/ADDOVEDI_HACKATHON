import { Outlet } from 'react-router';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMe } from '../auth/api';

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
    <div className="space-y-5">
      {facility && (
        <section className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{facility.name}</h1>
              <StatusBadge status={facility.verificationStatus} />
            </div>
            <p className="text-sm text-slate-600">
              {facility.district} · {user?.name}
              {user?.canVerifyRequests ? ' · request verifier' : ''}
            </p>
          </div>
          {FACILITY_NOTICE[facility.verificationStatus] && (
            <p role="status" className="w-full rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {FACILITY_NOTICE[facility.verificationStatus]}
            </p>
          )}
        </section>
      )}
      <Outlet />
    </div>
  );
}
