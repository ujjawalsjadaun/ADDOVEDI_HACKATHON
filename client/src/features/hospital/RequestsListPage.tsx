import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useMe } from '../auth/api';
import { useRequests, type RequestFilter } from './api';
import { requestState, URGENCY_LABEL, URGENCY_TONE } from './labels';

const VIEWS: { id: string; label: string; filter: RequestFilter }[] = [
  { id: 'active', label: 'Active', filter: { active: 'true' } },
  { id: 'verify', label: 'Needs verification', filter: { requestStatus: 'open' } },
  { id: 'closed', label: 'Closed', filter: { active: 'false' } },
  { id: 'all', label: 'All', filter: {} },
];

export function RequestsListPage() {
  const me = useMe();
  const [view, setView] = useState(VIEWS[0]!);
  const requests = useRequests({ ...view.filter, limit: 50 });
  const canCreate = me.data?.facility?.verificationStatus === 'verified';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Blood requests</h2>
        {canCreate ? (
          <Link to="/hospital/requests/new" className="btn-primary">
            New request
          </Link>
        ) : (
          <button type="button" className="btn-primary" disabled title="Your facility must be verified first">
            New request
          </button>
        )}
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view.id === v.id}
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 text-sm ${
              view.id === v.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {requests.isPending ? (
        <LoadingState />
      ) : requests.isError ? (
        <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
      ) : requests.data.data.length === 0 ? (
        <EmptyState title="No requests here">
          {view.id === 'active' ? 'There are no active requests at your facility.' : 'Nothing matches this view.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {requests.data.data.map((r) => {
            const state = requestState(r);
            const active = r.requestStatus !== 'closed';
            return (
              <li key={r.id}>
                <Link to={`/hospital/requests/${r.id}`} className="card block hover:border-brand-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{r.bloodGroup}</span>
                      <span className="font-mono text-sm text-slate-700">{r.publicCode}</span>
                      <StatusBadge status={state.label} label={state.label} tone={state.tone} />
                      {active && (
                        <StatusBadge
                          status={r.urgency}
                          label={`${URGENCY_LABEL[r.urgency]}${r.urgencyConfirmed ? '' : ' (suggested)'}`}
                          tone={URGENCY_TONE[r.urgency]}
                        />
                      )}
                    </div>
                    <span className="text-sm text-slate-600">
                      {r.slotsFilled}/{r.unitsRequested} unit{r.unitsRequested > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {r.patientLabel ? `${r.patientLabel} · ` : ''}
                    Deadline {formatDateTime(r.deadlineAt)}
                    {active && ` (${relativeTime(r.deadlineAt)})`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
