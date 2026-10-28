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
      <form onSubmit={apply} className="card grid gap-3 sm:grid-cols-4 sm:items-end border-slate-200">
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
        <button type="submit" className="btn-primary text-xs min-h-10">
          Filter log
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
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white shadow-xs">
            {q.data!.data.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </ul>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span>
              {total} entr{total === 1 ? 'y' : 'ies'} · Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-xs min-h-8 py-1 px-3" disabled={page <= 1 || q.isFetching} onClick={() => setFilter({ ...filter, page: page - 1 })}>
                ← Newer
              </button>
              <button type="button" className="btn-secondary text-xs min-h-8 py-1 px-3" disabled={page >= pages || q.isFetching} onClick={() => setFilter({ ...filter, page: page + 1 })}>
                Older →
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
    <li className="p-3.5 hover:bg-slate-50/50 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{formatDateTime(e.at)}</span>
          <span className="font-mono text-xs font-bold text-slate-800">{e.action}</span>
          {e.result !== 'success' && <StatusBadge status={e.result} tone="red" />}
          <span className="text-xs text-slate-500">
            by <strong className="text-slate-700">{e.actor.name ?? (e.actor.type === 'system' ? 'System Worker' : 'Unknown')}</strong>
            {e.actor.role && ` (${e.actor.role.replace('_', ' ')})`}
            {e.facilityName && ` · ${e.facilityName}`}
          </span>
        </div>
        {hasMore && (
          <button type="button" className="text-2xs font-semibold text-brand-700 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide details' : 'Inspect JSON'}
          </button>
        )}
      </div>
      {e.reason && <p className="mt-1 text-xs text-slate-600 italic">“{e.reason}”</p>}
      {open && (
        <pre className="mt-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-2xs text-slate-200 leading-normal">
          {JSON.stringify({ resource: `${e.resourceType}:${e.resourceId ?? '—'}`, changes: e.changes, detail: e.detail }, null, 2)}
        </pre>
      )}
    </li>
  );
}
