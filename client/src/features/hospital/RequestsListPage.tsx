import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useMe } from '../auth/api';
import { useRequests, type RequestFilter } from './api';
import { requestState, URGENCY_LABEL, URGENCY_TONE } from '../../lib/labels';

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
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Blood requests</h2>
          <p className="text-xs text-slate-500">Track, verify, and monitor patient requests at your facility</p>
        </div>
        {canCreate ? (
          <Link to="/hospital/requests/new" className="btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New request
          </Link>
        ) : (
          <button type="button" className="btn-primary opacity-60 cursor-not-allowed" disabled title="Your facility must be verified first">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New request
          </button>
        )}
      </div>

      <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view.id === v.id}
            onClick={() => setView(v)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              view.id === v.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
        <ul className="space-y-3">
          {requests.data.data.map((r) => {
            const state = requestState(r);
            const active = r.requestStatus !== 'closed';
            const progressPct = Math.min(100, Math.round((r.slotsFilled / r.unitsRequested) * 100));
            return (
              <li key={r.id}>
                <Link to={`/hospital/requests/${r.id}`} className="card-interactive block p-4.5 border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center justify-center rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold text-brand-700 border border-brand-200/70 shadow-2xs">
                        {r.bloodGroup}
                      </span>
                      <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {r.publicCode}
                      </span>
                      <StatusBadge status={state.label} label={state.label} tone={state.tone} />
                      {active && (
                        <StatusBadge
                          status={r.urgency}
                          label={`${URGENCY_LABEL[r.urgency]}${r.urgencyConfirmed ? '' : ' (suggested)'}`}
                          tone={URGENCY_TONE[r.urgency]}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">
                          {r.slotsFilled}/{r.unitsRequested} unit{r.unitsRequested > 1 ? 's' : ''}
                        </span>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-brand-500' : 'bg-slate-200'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      {r.patientLabel && <span className="text-slate-700">{r.patientLabel} ·</span>}
                      <span>Created {relativeTime(r.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Deadline {formatDateTime(r.deadlineAt)}</span>
                      {active && <span className="font-semibold text-brand-700">({relativeTime(r.deadlineAt)})</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
