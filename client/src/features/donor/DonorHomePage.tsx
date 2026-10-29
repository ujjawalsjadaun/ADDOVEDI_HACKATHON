import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { DonorAlertView, DonorAssignmentView } from '@golden-hour/shared';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { EtaBadge } from '../../components/ui/EtaBadge';
import { PageHeader } from '../../components/ui/PageHeader';
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

  if (profile.isPending) return <LoadingState label="Loading donor portal…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;

  const active = assignments.data?.filter((a) => ['accepted', 'en_route', 'arrived'].includes(a.status)) ?? [];
  const pending = alerts.data?.filter((a) => a.response === 'pending') ?? [];
  const history = alerts.data?.filter((a) => a.response !== 'pending') ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Donor"
        title={pending.length > 0 ? `${pending.length} request${pending.length > 1 ? 's' : ''} need${pending.length > 1 ? '' : 's'} your answer` : 'You are on the donor list'}
        subtitle={
          pending.length > 0
            ? 'Hospitals near you need your blood group. Please answer before the alert expires.'
            : 'When a verified hospital nearby needs your blood group, the request appears here and by SMS.'
        }
      />
      {/* ── AVAILABILITY TOGGLE CARD ─────────────────────────────── */}
      <AvailabilityCard availability={p.availability} stale={p.availabilityStale} updatedAt={p.availabilityUpdatedAt} />

      {/* ── NOT ALERTABLE REASONS ────────────────────────────────── */}
      {p.notAlertableReasons.length > 0 && (
        <section className="rounded-2xl border border-amber-300/80 bg-amber-50/80 p-5 text-amber-950 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true">
              <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-.75 8a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" clipRule="evenodd" />
            </svg>
            <h2 className="font-bold text-sm">Action Needed: You are not currently receiving emergency alerts</h2>
          </div>
          <ul className="list-disc space-y-1 pl-6 text-xs leading-relaxed text-amber-900">
            {p.notAlertableReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="pt-1">
            <Link to="/donor/profile" className="inline-flex items-center gap-1 text-xs font-bold text-amber-950 underline hover:text-black">
              Update Profile & Locality &rarr;
            </Link>
          </div>
        </section>
      )}

      {/* ── ACTIVE ASSIGNMENTS ────────────────────────────────────── */}
      {active.map((a) => (
        <ActiveAssignment key={a.id} assignment={a} />
      ))}

      {/* ── PENDING ALERTS QUEUE ──────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Emergency Requests For You</h2>
            {pending.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white animate-pulse">
                {pending.length}
              </span>
            )}
          </div>
          <DataFreshness
            updatedAt={alerts.dataUpdatedAt}
            staleAfterMs={45_000}
            isFetching={alerts.isFetching}
            isError={alerts.isError}
            onRefresh={() => void alerts.refetch()}
          />
        </div>

        {alerts.isPending ? (
          <LoadingState label="Checking for matching hospital requests…" />
        ) : alerts.isError ? (
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState title="No active alerts right now">
            <p>You will receive an alert whenever a nearby hospital needs your blood group.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {pending.map((a) => (
              <PendingAlert key={a.id} alert={a} busy={active.length > 0} />
            ))}
          </ul>
        )}
      </section>

      {/* ── HISTORICAL ALERTS ────────────────────────────────────── */}
      {history.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Alert History</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Group</th>
                  <th className="px-4 py-3 font-bold">Facility</th>
                  <th className="px-4 py-3 font-bold">Date & Time</th>
                  <th className="px-4 py-3 font-bold text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{a.bloodGroup}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.facility.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={a.response} label={ALERT_RESPONSE[a.response].label} tone={ALERT_RESPONSE[a.response].tone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function AvailabilityCard({ availability, stale, updatedAt }: { availability: 'available' | 'unavailable'; stale: boolean; updatedAt: string }) {
  const set = useSetAvailability();
  const available = availability === 'available';

  return (
    <section
      className={`flex flex-col gap-4 rounded-2xl border-2 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
        available ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-100'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${available ? 'signal-dot bg-emerald-600' : 'bg-slate-500'}`} aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-slate-900">
            {available ? 'You are Available to Donate' : 'You are Marked Unavailable'}
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Last updated {formatDateTime(updatedAt)}
          {stale && <span className="text-amber-800 font-semibold"> · Status is stale, please confirm.</span>}
        </p>
        <FormError error={set.error} />
      </div>

      <div className="flex items-center gap-2">
        {stale && available && (
          <button
            type="button"
            className="btn-secondary h-9 text-xs"
            disabled={set.isPending}
            onClick={() => set.mutate('available')}
          >
            Still Available
          </button>
        )}
        <button
          type="button"
          className={`h-9 px-4 text-xs font-bold ${available ? 'btn-secondary' : 'btn-primary'}`}
          disabled={set.isPending}
          onClick={() => set.mutate(available ? 'unavailable' : 'available')}
        >
          {available ? 'Mark Unavailable' : 'Turn Availability ON'}
        </button>
      </div>
    </section>
  );
}

function PendingAlert({ alert, busy }: { alert: DonorAlertView; busy: boolean }) {
  const respond = useRespondAlert();

  return (
    <li className="overflow-hidden rounded-2xl border-2 border-brand-300 bg-white p-6 shadow-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 font-mono text-xl font-black text-white shadow-md">
            {alert.bloodGroup}
          </span>
          <div>
            <h3 className="text-lg font-extrabold leading-tight text-slate-900">{alert.facility.name}</h3>
            <span className="text-xs text-slate-500">{alert.facility.district}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EtaBadge eta={alert.eta} />
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="text-xs text-slate-600 font-medium">Facility Address: {alert.facility.address}</p>
        <p className="text-xs font-semibold text-slate-900">
          Needed by <span className="text-brand-700">{formatDateTime(alert.deadlineAt)}</span> ({relativeTime(alert.deadlineAt)})
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>Please respond before <strong className="text-slate-700">{relativeTime(alert.expiresAt)}</strong></span>
        <Link to={`/check/${alert.publicCode}`} className="font-mono text-brand-700 underline font-semibold">
          Verify: {alert.publicCode}
        </Link>
      </div>

      <FormError error={respond.error} />
      {busy && (
        <p className="text-xs font-semibold text-amber-800">
          You currently have an active donation assignment. Finish or withdraw before accepting another request.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          className="btn-primary h-10 px-5 text-xs font-bold"
          disabled={respond.isPending || busy}
          onClick={() => respond.mutate({ alertId: alert.id, decision: 'accept' })}
        >
          ✓ I Can Donate (Accept)
        </button>
        <button
          type="button"
          className="btn-secondary h-10 px-4 text-xs font-semibold"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ alertId: alert.id, decision: 'decline' })}
        >
          Cannot Make It
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Clinical eligibility (hemoglobin, recent rest period) is evaluated by hospital staff upon arrival.
      </p>
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
    <section className="card rounded-2xl border-2 border-sky-300/80 bg-gradient-to-b from-sky-50/70 to-white p-6 shadow-sm space-y-4" aria-label="Your current donation">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 rounded-full bg-sky-500 animate-ping" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">Current Committed Donation: {a.facility.name}</h2>
        </div>
        <StatusBadge status={a.status} label={status.label} tone={status.tone} />
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 rounded-xl bg-white/90 p-4 ring-1 ring-sky-200/50">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Facility</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {a.facility.address}, {a.facility.district}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Hospital Contact Line</dt>
          <dd className="mt-0.5">
            <a href={`tel:${a.facility.phone}`} className="font-bold text-brand-700 underline">
              {a.facility.phone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Transfusion Deadline</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {formatDateTime(a.deadlineAt)} ({relativeTime(a.deadlineAt)})
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Travel Distance & ETA</dt>
          <dd className="mt-0.5">
            <EtaBadge eta={a.eta} />
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <a
          className="btn-secondary h-9 px-3 text-xs font-semibold"
          href={`https://www.openstreetmap.org/?mlat=${a.facility.location.lat}&mlon=${a.facility.location.lng}#map=15/${a.facility.location.lat}/${a.facility.location.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          🗺 View Hospital Location
        </a>
      </div>

      <FormError error={update.error} />

      {!withdrawing ? (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-sky-100">
          {a.allowedActions.includes('en_route') && (
            <button
              type="button"
              className="btn-primary h-10 px-5 text-xs font-bold"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: a.id, expectedVersion: a.version, status: 'en_route' })}
            >
              🚗 I'm On My Way
            </button>
          )}
          {a.allowedActions.includes('arrived') && (
            <button
              type="button"
              className="btn-primary h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: a.id, expectedVersion: a.version, status: 'arrived' })}
            >
              ✓ I Have Arrived at Facility
            </button>
          )}
          {a.allowedActions.includes('withdraw') && (
            <button
              type="button"
              className="btn-ghost text-xs text-rose-700 hover:bg-rose-50 font-semibold"
              onClick={() => setWithdrawing(true)}
            >
              Unable to proceed (Withdraw)
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={withdraw} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <TextAreaField
            label="Reason for withdrawal"
            required
            placeholder="Please let the hospital know so they can immediately dispatch the next donor batch…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-danger h-9 px-4 text-xs font-bold" disabled={update.isPending}>
              Confirm Withdrawal
            </button>
            <button type="button" className="btn-secondary h-9 px-3 text-xs" onClick={() => setWithdrawing(false)}>
              Back
            </button>
          </div>
        </form>
      )}

      {a.status === 'arrived' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          Arrival confirmed! Hospital phlebotomy staff will take over for sample cross-matching. Thank you for your contribution.
        </div>
      )}
    </section>
  );
}
