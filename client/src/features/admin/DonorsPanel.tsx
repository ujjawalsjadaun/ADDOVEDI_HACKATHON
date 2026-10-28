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
      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 leading-relaxed">
        <strong>Verification Guideline:</strong> Confirm identity authenticity and stated blood group plausibility (e.g. government donor registry, hospital card). This administrative check precedes dispatch alerts.
      </div>

      <div role="group" aria-label="Filter donors" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={view.id === f.id}
            onClick={() => setView(f)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              view.id === f.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
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
        <ul className="space-y-3.5">
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
    <li className="card border-slate-200 hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-2xs font-bold text-brand-700 border border-brand-200">
              {d.bloodGroup}
            </span>
            <h3 className="text-base font-bold text-slate-900">{d.name}</h3>
            <StatusBadge status={d.verificationStatus} tone={d.verificationStatus === 'verified' ? 'green' : 'amber'} />
            {d.reviewStatus === 'under_review' && <StatusBadge status="under_review" label="under review" tone="red" />}
            {d.accountStatus !== 'active' && <StatusBadge status={d.accountStatus} />}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {d.email}
            {d.phoneMasked && ` · ${d.phoneMasked}`} · {d.anchorLabel ?? 'No location centroid'} · <span className="capitalize">{d.availability}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-2 text-2xs text-slate-400 pt-0.5">
            <span>Last donation: <strong className="text-slate-600">{d.lastDonationOn ?? 'unknown'}</strong></span>
            <span>·</span>
            <span>Missed: <strong className="text-slate-600">{d.strikesLast180Days}</strong> (180d)</span>
            <span>·</span>
            <span>Consent: contact {d.consent.contact ? '✓' : '✗'}, location {d.consent.location ? '✓' : '✗'}</span>
            <span>·</span>
            <span>Registered {formatDateTime(d.createdAt)}</span>
          </div>
        </div>
        {!pending && (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={
                  a.danger
                    ? 'btn-secondary text-xs min-h-8 py-1 px-3 text-rose-700 hover:text-rose-800 hover:border-rose-200'
                    : 'btn-secondary text-xs min-h-8 py-1 px-3'
                }
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
