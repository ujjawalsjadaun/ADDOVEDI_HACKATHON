import { useState } from 'react';
import { Link } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime } from '../../lib/format';
import { useAdminEscalations } from './api';

const VIEWS = [
  { id: 'open', label: 'Open awaiting donor', open: 'true' as const },
  { id: 'all', label: 'All escalated', open: 'false' as const },
];

function stepBadge(step: number) {
  if (step >= 3) {
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Level 3 (15m+)</span>;
  }
  if (step === 2) {
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Level 2 (10m)</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">Level 1 (5m)</span>;
}

/**
 * Admin escalation queue (Phase 10): lists requests that have not been fulfilled within
 * ladder thresholds (5m widen search, 10m facility notice, 15m admin intervention).
 */
export function EscalationsPanel() {
  const [view, setView] = useState(VIEWS[0]!);
  const q = useAdminEscalations({ open: view.open });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Escalation Ladder Queue</h2>
          <p className="text-sm text-slate-600">
            Requests that passed the 5, 10, or 15-minute verification thresholds without finding available donors.
          </p>
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={30_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>

      <div className="flex gap-2">
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

      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.data.length === 0 ? (
        <EmptyState title="No escalated requests">
          <p>All verified requests have found donors or are within initial response windows.</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Public code</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Escalation level</th>
                <th className="px-4 py-3">Elapsed</th>
                <th className="px-4 py-3">Alert batches</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {q.data!.data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium">
                    <Link to={`/admin/requests/${item.requestId}`} className="text-brand-700 underline">
                      {item.publicCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold">{item.bloodGroup}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.facilityName ?? 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{item.facilityDistrict ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">{stepBadge(item.escalationStep)}</td>
                  <td className="px-4 py-3 text-slate-600">{item.elapsedMinutes} min</td>
                  <td className="px-4 py-3 text-slate-600">{item.alertBatches} batches</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(item.deadlineAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/requests/${item.requestId}`}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
                    >
                      View & Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
