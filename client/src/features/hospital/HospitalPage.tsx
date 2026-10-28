import { ComingSoon } from '../../components/ui/ComingSoon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMe } from '../auth/api';

const FACILITY_NOTICE: Record<string, string> = {
  pending: 'Your facility is waiting for an administrator to verify it. Requests cannot be raised until then.',
  suspended: 'Your facility is suspended. Requests cannot be raised or verified. Contact the Golden Hour administrator.',
  rejected: 'Your facility registration was rejected. Contact the Golden Hour administrator.',
};

export function HospitalPage() {
  const me = useMe();
  const facility = me.data?.facility;
  const user = me.data?.user;

  return (
    <div className="space-y-4">
      {facility && (
        <section className="card">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{facility.name}</h2>
            <StatusBadge status={facility.verificationStatus} />
          </div>
          <p className="text-sm text-slate-600">
            {facility.district} · signed in as {user?.name}
            {user?.canVerifyRequests ? ' (request verifier)' : ''}
          </p>
          {FACILITY_NOTICE[facility.verificationStatus] && (
            <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {FACILITY_NOTICE[facility.verificationStatus]}
            </p>
          )}
        </section>
      )}
      <ComingSoon title="Blood requests" phase={4} description="Create and verify blood requests and confirm fulfilment." />
    </div>
  );
}
