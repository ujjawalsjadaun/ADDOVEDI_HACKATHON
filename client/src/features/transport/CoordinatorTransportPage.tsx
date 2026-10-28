import { DataFreshness } from '../../components/ui/DataFreshness';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { useTransportTasks } from './api';
import { TransportTaskCard } from './components/TransportTaskCard';

/** Coordinator view: tasks waiting for someone, and tasks I have taken. Donor contact appears only after taking a task. */
export function CoordinatorTransportPage() {
  const open = useTransportTasks({ scope: 'open' });
  const mine = useTransportTasks({ scope: 'mine' });
  const myActive = mine.data?.filter((t) => !['completed', 'failed', 'cancelled'].includes(t.status)) ?? [];
  const myDone = mine.data?.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status)) ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">My transport tasks</h2>
          <DataFreshness updatedAt={mine.dataUpdatedAt} staleAfterMs={90_000} isFetching={mine.isFetching} isError={mine.isError} onRefresh={() => void mine.refetch()} />
        </div>
        {mine.isPending ? (
          <LoadingState />
        ) : mine.isError && !mine.data ? (
          <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
        ) : myActive.length === 0 ? (
          <EmptyState title="Nothing in progress">Take a task below when you can help.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {myActive.map((t) => (
              <TransportTaskCard key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waiting for a coordinator</h2>
        {open.isPending ? (
          <LoadingState />
        ) : open.isError && !open.data ? (
          <ErrorState error={open.error} onRetry={() => void open.refetch()} />
        ) : open.data!.length === 0 ? (
          <EmptyState title="No open tasks" />
        ) : (
          <ul className="space-y-3">
            {open.data!.map((t) => (
              <TransportTaskCard key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>

      {myDone.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Finished</h2>
          <ul className="space-y-3">
            {myDone.slice(0, 10).map((t) => (
              <TransportTaskCard key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
