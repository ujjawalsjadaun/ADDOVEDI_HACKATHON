import { useState, type FormEvent } from 'react';
import type { AuditEntryView } from '@golden-hour/shared';
import { SelectField, TextField } from '../../components/ui/form';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../lib/format';
import { useAuditLog, type AuditFilter } from './api';

const PAGE_SIZE = 50;

/** Read-only audit trail. Entries never contain passwords, tokens, phone numbers or patient references. */
export function AuditPanel() {
  const [draft, setDraft] = useState({ action: '', resourceType: '', result: '' });
  const [filter, setFilter] = useState<AuditFilter>({ page: 1, limit: PAGE_SIZE });
  const q = useAuditLog(filter);

  function apply(e: FormEvent) {
    e.preventDefault();
    setFilter({
      page: 1,
      limit: PAGE_SIZE,
      action: draft.action || undefined,
      resourceType: (draft.resourceType || undefined) as AuditFilter['resourceType'],
      result: (draft.result || undefined) as AuditFilter['result'],
    });
  }

  const total = q.data?.meta.total ?? 0;
  const page = filter.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-4">
      <form onSubmit={apply} className="card grid gap-3 sm:grid-cols-4 sm:items-end">
        <TextField label="Action starts with" placeholder="e.g. request. or auth.login_failed" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
        <SelectField
          label="Resource"
          value={draft.resourceType}
          onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}
          options={[
            { value: '', label: 'Any' },
            { value: 'bloodRequest', label: 'Blood requests' },
            { value: 'hospital', label: 'Facilities' },
            { value: 'user', label: 'Accounts' },
            { value: 'roadReport', label: 'Road reports' },
            { value: 'familyLead', label: 'Family leads' },
            { value: 'stockTransfer', label: 'Stock transfers' },
          ]}
        />
        <SelectField
          label="Result"
          value={draft.result}
          onChange={(e) => setDraft({ ...draft, result: e.target.value })}
          options={[
            { value: '', label: 'Any' },
            { value: 'success', label: 'Success' },
            { value: 'denied', label: 'Denied' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.data.length === 0 ? (
        <EmptyState title="No audit entries match" />
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {q.data!.data.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {total} entr{total === 1 ? 'y' : 'ies'} · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" disabled={page <= 1 || q.isFetching} onClick={() => setFilter({ ...filter, page: page - 1 })}>
                Newer
              </button>
              <button type="button" className="btn-secondary" disabled={page >= pages || q.isFetching} onClick={() => setFilter({ ...filter, page: page + 1 })}>
                Older
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AuditRow({ entry: e }: { entry: AuditEntryView }) {
  const [open, setOpen] = useState(false);
  const hasMore = !!(e.changes || e.detail);
  return (
    <li className="px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{formatDateTime(e.at)}</span>
        <span className="font-mono font-medium">{e.action}</span>
        {e.result !== 'success' && <StatusBadge status={e.result} tone="red" />}
        <span className="text-slate-600">
          by {e.actor.name ?? (e.actor.type === 'system' ? 'System' : 'unknown')}
          {e.actor.role && ` (${e.actor.role.replace('_', ' ')})`}
          {e.facilityName && ` · ${e.facilityName}`}
        </span>
        {hasMore && (
          <button type="button" className="text-xs underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'less' : 'details'}
          </button>
        )}
      </div>
      {e.reason && <p className="text-slate-700">“{e.reason}”</p>}
      {open && (
        <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
          {JSON.stringify({ resource: `${e.resourceType}:${e.resourceId ?? '—'}`, changes: e.changes, detail: e.detail }, null, 2)}
        </pre>
      )}
    </li>
  );
}
