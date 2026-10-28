import { useState } from 'react';
import { Link } from 'react-router';
import type { NotificationStatus, NotificationView } from '@golden-hour/shared';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge, type BadgeTone } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useNotificationHealth, useNotifications, useRetryNotification } from './api';

const STATUS: Record<NotificationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'queued', tone: 'amber' },
  sending: { label: 'sending', tone: 'blue' },
  sent: { label: 'sent (provider accepted)', tone: 'blue' },
  delivered: { label: 'delivered (receipt)', tone: 'green' },
  failed: { label: 'failed', tone: 'red' },
  unknown: { label: 'unknown', tone: 'slate' },
};

const FILTERS: (NotificationStatus | undefined)[] = [undefined, 'pending', 'sent', 'failed'];

/** SMS outbox. In simulated mode this is exactly what would have been sent — no phone was contacted. */
export function NotificationsPanel() {
  const [status, setStatus] = useState<NotificationStatus | undefined>(undefined);
  const health = useNotificationHealth();
  const list = useNotifications(status);
  const h = health.data;

  return (
    <section className="space-y-4">
      {h?.provider.simulated && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Simulated SMS.</strong> Messages below were not sent to any phone. They show exactly what a real provider would receive.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Queued" value={(h?.counts.pending ?? 0) + (h?.counts.sending ?? 0)} />
        <StatCard label="Sent (provider accepted)" value={h?.counts.sent ?? 0} />
        <StatCard label="Delivered (receipt)" value={h?.counts.delivered ?? 0} />
        <StatCard label="Failed" value={h?.counts.failed ?? 0} alertWhenNonZero="danger" />
      </div>
      {h?.oldestPendingAt && <p className="text-sm text-amber-800">Oldest queued message waiting since {relativeTime(h.oldestPendingAt)}.</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f ?? 'all'}
              type="button"
              aria-pressed={status === f}
              onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1 text-sm ${status === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'}`}
            >
              {f ? STATUS[f].label.split(' (')[0] : 'All'}
            </button>
          ))}
        </div>
        <DataFreshness updatedAt={list.dataUpdatedAt} staleAfterMs={90_000} isFetching={list.isFetching} isError={list.isError} onRefresh={() => void list.refetch()} />
      </div>

      {list.isPending ? (
        <LoadingState />
      ) : list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data!.data.length === 0 ? (
        <EmptyState title="No messages" />
      ) : (
        <ul className="space-y-2">
          {list.data!.data.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ n }: { n: NotificationView }) {
  const [retrying, setRetrying] = useState(false);
  const retry = useRetryNotification();
  const s = STATUS[n.status];
  return (
    <li className="card space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={n.status} label={s.label} tone={s.tone} />
        <span className="font-medium">{n.recipient.name ?? 'Unknown recipient'}</span>
        <span className="text-slate-500">{n.recipient.phoneMasked ?? 'no number'}</span>
        {n.request && (
          <Link to={`/admin/requests/${n.request.id}`} className="font-mono text-brand-700 underline">
            {n.request.publicCode}
          </Link>
        )}
        <span className="text-xs text-slate-500">
          {formatDateTime(n.createdAt)} · attempt {n.attempts}
          {n.nextAttemptAt && ` · next try ${relativeTime(n.nextAttemptAt)}`}
          {n.sentAt && ` · sent ${formatDateTime(n.sentAt)}`}
        </span>
      </div>
      <p className="rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{n.body}</p>
      {n.lastError && <p className="text-xs text-red-700">Last error: {n.lastError}</p>}
      {n.canRetry && !retrying && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            retry.reset();
            setRetrying(true);
          }}
        >
          Retry
        </button>
      )}
      {retrying && (
        <ReasonForm
          title="Retry this message? Fix the cause first (e.g. the donor's phone number)."
          confirmLabel="Queue again"
          pending={retry.isPending}
          error={retry.error}
          onCancel={() => setRetrying(false)}
          onConfirm={(reason) => retry.mutate({ id: n.id, reason }, { onSuccess: () => setRetrying(false) })}
        />
      )}
    </li>
  );
}
