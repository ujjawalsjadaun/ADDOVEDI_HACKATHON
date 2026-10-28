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
        <div role="group" aria-label="Show" className="flex gap-1">
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
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>

      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.data.length === 0 ? (
        <EmptyState title="No requests" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Facility</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Units</th>
                <th className="px-3 py-2">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data!.data.map((r) => {
                const s = requestState(r);
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link to={`/admin/requests/${r.id}`} className="font-mono text-brand-700 underline">
                        {r.publicCode}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.facilityName ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold">{r.bloodGroup}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.label} label={s.label} tone={s.tone} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.slotsFilled}/{r.unitsRequested}
                    </td>
                    <td className="px-3 py-2">
                      {formatDateTime(r.deadlineAt)}
                      {r.requestStatus !== 'closed' && <span className="text-slate-500"> ({relativeTime(r.deadlineAt)})</span>}
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
