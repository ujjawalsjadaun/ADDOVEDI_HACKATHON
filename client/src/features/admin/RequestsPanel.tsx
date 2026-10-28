import { useState } from 'react';
import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { requestState } from '../../lib/labels';
import { useAdminRequests } from './api';

const VIEWS = [
  { id: 'active', label: 'Active', filter: { active: 'true' as const } },
  { id: 'closed', label: 'Closed', filter: { active: 'false' as const } },
];

/** Every facility's requests. Admins can read, reject, cancel and alert more donors — never verify or fulfil. */
export function RequestsPanel() {
  const [view, setView] = useState(VIEWS[0]!);
  const q = useAdminRequests({ ...view.filter, limit: 100 });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>

      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.data.length === 0 ? (
        <EmptyState title="No requests" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/80 text-left text-2xs uppercase tracking-wider text-slate-500 border-b border-slate-200/70 font-bold">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {q.data!.data.map((r) => {
                const s = requestState(r);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/admin/requests/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {r.publicCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.facilityName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-2xs font-bold text-brand-700 border border-brand-200">
                        {r.bloodGroup}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.label} label={s.label} tone={s.tone} />
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 tabular-nums">
                      {r.slotsFilled}/{r.unitsRequested}
                    </td>
                    <td className="px-4 py-3 text-2xs text-slate-600">
                      <span>{formatDateTime(r.deadlineAt)}</span>
                      {r.requestStatus !== 'closed' && <span className="block text-brand-700 font-semibold">{relativeTime(r.deadlineAt)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
