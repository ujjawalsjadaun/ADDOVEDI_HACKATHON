import { PageHeader } from '../../components/ui/PageHeader';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { FormError } from '../../components/ui/form';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useMarkRelayed, useRelayAlerts } from './api';

/**
 * Village relay: donors in your village who have no mobile data still get alerts by SMS, but a trusted
 * local person can pass an urgent one on by voice. The donor answers for themselves (app, or SMS YES/NO).
 */
export function RelayPage() {
  const q = useRelayAlerts();
  const mark = useMarkRelayed();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Coordinator"
        title="Village relay"
        subtitle="Open donor alerts in your village, to pass on to donors who may not see the app."
        meta={<DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={60_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />}
      />
      <FormError error={mark.error} />
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title="Nothing to relay right now">
          <p>Alerts appear here only for donors who chose your village, agreed to be contacted, and have an alert still waiting for an answer. Ask an administrator to set your village if you expect some.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {q.data!.map((a) => (
            <li key={a.alertId} className="card space-y-2 border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">
                  <span className="mr-2 rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-brand-700">{a.bloodGroup}</span>
                  {a.facility.name}, {a.facility.district}
                </p>
                <span className="text-2xs font-semibold text-amber-800">Answer needed {relativeTime(a.expiresAt)}</span>
              </div>
              <p className="text-xs text-slate-600">
                Donor <strong className="text-slate-900">{a.donor.name}</strong>
                {a.donor.phone && (
                  <>
                    {' '}
                    ·{' '}
                    <a href={`tel:${a.donor.phone}`} className="font-semibold text-brand-700 underline">
                      {a.donor.phone}
                    </a>
                  </>
                )}
                {a.shortCode && <> · can reply by SMS: YES {a.shortCode} / NO {a.shortCode}</>}
              </p>
              <p className="text-2xs text-slate-500">
                Needed by {formatDateTime(a.deadlineAt)} · code <span className="font-mono">{a.publicCode}</span> (the donor can check it at /check)
              </p>
              {a.relayedAt ? (
                <p className="text-xs font-semibold text-emerald-800">
                  Passed on {relativeTime(a.relayedAt)}
                  {a.relayedBy ? ` by ${a.relayedBy}` : ''}
                </p>
              ) : (
                <button type="button" className="btn-secondary text-xs" disabled={mark.isPending} onClick={() => mark.mutate(a.alertId)}>
                  I told the donor
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
