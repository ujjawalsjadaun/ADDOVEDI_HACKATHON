import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { DonorAlertView, DonorAssignmentView } from '@golden-hour/shared';
import { EtaBadge } from '../../components/ui/EtaBadge';
import { FormError, TextAreaField } from '../../components/ui/form';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { ALERT_RESPONSE, ASSIGNMENT_STATUS } from '../../lib/labels';
import { useDonorAlerts, useDonorAssignments, useDonorProfile, useRespondAlert, useSetAvailability, useUpdateAssignment } from './api';

export function DonorHomePage() {
  const profile = useDonorProfile();
  const alerts = useDonorAlerts();
  const assignments = useDonorAssignments();

  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;

  const active = assignments.data?.filter((a) => ['accepted', 'en_route', 'arrived'].includes(a.status)) ?? [];
  const pending = alerts.data?.filter((a) => a.response === 'pending') ?? [];
  const history = alerts.data?.filter((a) => a.response !== 'pending') ?? [];

  return (
    <div className="space-y-5">
      <AvailabilityCard availability={p.availability} stale={p.availabilityStale} updatedAt={p.availabilityUpdatedAt} />

      {p.notAlertableReasons.length > 0 && (
        <section className="card border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-900">You won't receive alerts yet</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {p.notAlertableReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Link to="/donor/profile" className="mt-3 inline-block text-sm font-medium text-amber-900 underline">
            Update my profile
          </Link>
        </section>
      )}

      {active.map((a) => (
        <ActiveAssignment key={a.id} assignment={a} />
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Requests for you</h2>
        {alerts.isPending ? (
          <LoadingState />
        ) : alerts.isError ? (
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState title="No open requests">When a hospital nearby needs your blood group, the request appears here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <PendingAlert key={a.id} alert={a} busy={active.length > 0} />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Earlier alerts</h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <span className="font-semibold">{a.bloodGroup}</span> · {a.facility.name} · {formatDateTime(a.createdAt)}
                </span>
                <StatusBadge status={a.response} label={ALERT_RESPONSE[a.response].label} tone={ALERT_RESPONSE[a.response].tone} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AvailabilityCard({ availability, stale, updatedAt }: { availability: 'available' | 'unavailable'; stale: boolean; updatedAt: string }) {
  const set = useSetAvailability();
  const available = availability === 'available';
  return (
    <section className="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">{available ? 'You are available to donate' : 'You are marked unavailable'}</h2>
        <p className="text-sm text-slate-600">
          Updated {formatDateTime(updatedAt)}
          {stale && ' — please confirm it is still correct.'}
        </p>
        <FormError error={set.error} />
      </div>
      <div className="flex gap-2">
        {stale && available && (
          <button type="button" className="btn-secondary" disabled={set.isPending} onClick={() => set.mutate('available')}>
            Still available
          </button>
        )}
        <button type="button" className={available ? 'btn-secondary' : 'btn-primary'} disabled={set.isPending} onClick={() => set.mutate(available ? 'unavailable' : 'available')}>
          {available ? 'Mark unavailable' : 'Mark available'}
        </button>
      </div>
    </section>
  );
}

function PendingAlert({ alert, busy }: { alert: DonorAlertView; busy: boolean }) {
  const respond = useRespondAlert();
  return (
    <li className="card space-y-2 border-brand-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-50 px-2 py-0.5 text-lg font-bold text-brand-700">{alert.bloodGroup}</span>
        <span className="font-semibold">{alert.facility.name}</span>
        <span className="text-sm text-slate-600">{alert.facility.district}</span>
      </div>
      <p className="text-sm text-slate-700">{alert.facility.address}</p>
      <p className="text-sm text-slate-700">
        Needed by <strong>{formatDateTime(alert.deadlineAt)}</strong> ({relativeTime(alert.deadlineAt)}) · <EtaBadge eta={alert.eta} />
      </p>
      <p className="text-xs text-slate-500">
        Please answer {relativeTime(alert.expiresAt)}. Verify this request any time at{' '}
        <Link to={`/check/${alert.publicCode}`} className="font-mono underline">
          /check/{alert.publicCode}
        </Link>
        .
      </p>
      <FormError error={respond.error} />
      {busy && <p className="text-sm text-amber-800">Finish or withdraw from your current donation before accepting another.</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={respond.isPending || busy} onClick={() => respond.mutate({ alertId: alert.id, decision: 'accept' })}>
          I can come
        </button>
        <button type="button" className="btn-secondary" disabled={respond.isPending} onClick={() => respond.mutate({ alertId: alert.id, decision: 'decline' })}>
          I can't
        </button>
      </div>
      <p className="text-xs text-slate-500">Accepting is not a medical check — hospital staff decide on arrival whether you can donate.</p>
    </li>
  );
}

function ActiveAssignment({ assignment: a }: { assignment: DonorAssignmentView }) {
  const update = useUpdateAssignment();
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const status = ASSIGNMENT_STATUS[a.status];

  function withdraw(e: FormEvent) {
    e.preventDefault();
    update.mutate({ id: a.id, expectedVersion: a.version, status: 'withdrawn', reason }, { onSuccess: () => setWithdrawing(false) });
  }

  return (
    <section className="card space-y-3 border-sky-200 bg-sky-50" aria-label="Your current donation">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Your donation: {a.facility.name}</h2>
        <StatusBadge status={a.status} label={status.label} tone={status.tone} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Go to</dt>
          <dd>
            {a.facility.address}, {a.facility.district}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Hospital phone</dt>
          <dd>
            <a href={`tel:${a.facility.phone}`} className="font-medium text-brand-700 underline">
              {a.facility.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Needed by</dt>
          <dd>
            {formatDateTime(a.deadlineAt)} ({relativeTime(a.deadlineAt)})
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Travel</dt>
          <dd>
            <EtaBadge eta={a.eta} />
          </dd>
        </div>
      </dl>
      <a
        className="text-sm font-medium text-brand-700 underline"
        href={`https://www.openstreetmap.org/?mlat=${a.facility.location.lat}&mlon=${a.facility.location.lng}#map=15/${a.facility.location.lat}/${a.facility.location.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        Open the hospital on a map
      </a>
      <FormError error={update.error} />
      {!withdrawing ? (
        <div className="flex flex-wrap gap-2">
          {a.allowedActions.includes('en_route') && (
            <button type="button" className="btn-primary" disabled={update.isPending} onClick={() => update.mutate({ id: a.id, expectedVersion: a.version, status: 'en_route' })}>
              I'm on my way
            </button>
          )}
          {a.allowedActions.includes('arrived') && (
            <button type="button" className="btn-primary" disabled={update.isPending} onClick={() => update.mutate({ id: a.id, expectedVersion: a.version, status: 'arrived' })}>
              I've arrived
            </button>
          )}
          {a.allowedActions.includes('withdraw') && (
            <button type="button" className="btn-secondary text-red-700" onClick={() => setWithdrawing(true)}>
              I can't make it
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={withdraw} className="space-y-2">
          <TextAreaField
            label="Tell the hospital why (they will alert another donor)"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              Withdraw
            </button>
            <button type="button" className="btn-secondary" onClick={() => setWithdrawing(false)}>
              Back
            </button>
          </div>
        </form>
      )}
      {a.status === 'arrived' && <p className="text-sm text-slate-700">Thank you! Hospital staff will take it from here.</p>}
    </section>
  );
}
