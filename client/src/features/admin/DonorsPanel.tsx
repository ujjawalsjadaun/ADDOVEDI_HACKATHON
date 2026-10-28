import { useState } from 'react';
import type { AdminDonorView } from '@golden-hour/shared';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../lib/format';
import { useAdminDonors, useDonorDecision } from './api';

const FILTERS = [
  { id: 'unverified', label: 'Awaiting verification', filter: { verificationStatus: 'unverified' as const } },
  { id: 'review', label: 'Under review', filter: { reviewStatus: 'under_review' as const } },
  { id: 'verified', label: 'Verified', filter: { verificationStatus: 'verified' as const } },
  { id: 'all', label: 'All', filter: {} },
];

type Pending = { kind: 'verification' | 'review'; decision: string; label: string; danger?: boolean };

export function DonorsPanel() {
  const [view, setView] = useState(FILTERS[0]!);
  const donors = useAdminDonors({ ...view.filter, limit: 50 });

  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">
        Verify that a donor is a real, reachable person and that their stated blood group is plausible (e.g. from a donor card). This is
        not a medical check.
      </p>
      <div role="group" aria-label="Filter donors" className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={view.id === f.id}
            onClick={() => setView(f)}
            className={`rounded-full px-3 py-1 text-sm ${
              view.id === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {donors.isPending ? (
        <LoadingState />
      ) : donors.isError ? (
        <ErrorState error={donors.error} onRetry={() => void donors.refetch()} />
      ) : donors.data.data.length === 0 ? (
        <EmptyState title="No donors here">Nothing matches this filter.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {donors.data.data.map((d) => (
            <DonorRow key={d.userId} donor={d} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DonorRow({ donor: d }: { donor: AdminDonorView }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const decide = useDonorDecision();
  const actions: Pending[] = [
    d.verificationStatus === 'unverified'
      ? { kind: 'verification', decision: 'verified', label: 'Verify' }
      : { kind: 'verification', decision: 'unverified', label: 'Revoke verification', danger: true },
    ...(d.reviewStatus === 'under_review'
      ? [{ kind: 'review' as const, decision: 'ok', label: 'Clear review' }]
      : [{ kind: 'review' as const, decision: 'under_review', label: 'Place under review', danger: true }]),
  ];

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{d.bloodGroup}</span>
            <h3 className="font-semibold">{d.name}</h3>
            <StatusBadge status={d.verificationStatus} tone={d.verificationStatus === 'verified' ? 'green' : 'amber'} />
            {d.reviewStatus === 'under_review' && <StatusBadge status="under_review" label="under review" tone="red" />}
            {d.accountStatus !== 'active' && <StatusBadge status={d.accountStatus} />}
          </div>
          <p className="text-sm text-slate-600">
            {d.email}
            {d.phoneMasked && ` · ${d.phoneMasked}`} · {d.anchorLabel ?? 'no location'} · {d.availability}
          </p>
          <p className="text-xs text-slate-500">
            Last donation: {d.lastDonationOn ?? 'unknown'} · missed donations (180 days): {d.strikesLast180Days} · consent: contact{' '}
            {d.consent.contact ? 'yes' : 'no'}, location {d.consent.location ? 'yes' : 'no'} · registered {formatDateTime(d.createdAt)}
          </p>
        </div>
        {!pending && (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={a.danger ? 'btn-secondary text-red-700' : 'btn-secondary'}
                onClick={() => {
                  decide.reset();
                  setPending(a);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {pending && (
        <ReasonForm
          title={`${pending.label}: ${d.name}?`}
          confirmLabel={pending.label}
          danger={pending.danger}
          pending={decide.isPending}
          error={decide.error}
          onCancel={() => setPending(null)}
          onConfirm={(reason) =>
            decide.mutate({ userId: d.userId, kind: pending.kind, decision: pending.decision, reason }, { onSuccess: () => setPending(null) })
          }
        />
      )}
    </li>
  );
}
