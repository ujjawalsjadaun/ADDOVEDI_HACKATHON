import { useState, type FormEvent } from 'react';
import type { TransportAction, TransportTaskView } from '@golden-hour/shared';
import { fieldError, FormError, TextAreaField } from '../../../components/ui/form';
import { StatusBadge, type BadgeTone } from '../../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../../lib/format';
import { useTransportAction } from '../api';

const STATUS: Record<TransportTaskView['status'], { label: string; tone: BadgeTone }> = {
  requested: { label: 'Needs a coordinator', tone: 'amber' },
  assigned: { label: 'Assigned', tone: 'blue' },
  picked_up: { label: 'Picked up', tone: 'blue' },
  handed_over: { label: 'Handed over — awaiting receipt', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

const ACTION_LABEL: Record<TransportAction, string> = {
  claim: 'Take this task',
  picked_up: 'Picked up',
  handed_over: 'Handed over',
  complete: 'Confirm received',
  fail: 'Report failure',
  cancel: 'Cancel task',
};

const KIND_LABEL = { donor_pickup: 'Donor pickup', unit_transfer: 'Blood unit transfer' } as const;

function mapLink(p: { lat: number; lng: number } | null) {
  return p ? `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}` : null;
}

/** One transport task with the actions the server allows this user. Never changes the blood request's state. */
export function TransportTaskCard({ task: t, showRequest = true }: { task: TransportTaskView; showRequest?: boolean }) {
  const act = useTransportAction();
  const [pending, setPending] = useState<TransportAction | null>(null);
  const [note, setNote] = useState('');
  const needsNote = pending === 'fail' || pending === 'cancel';
  const s = STATUS[t.status];

  function run(action: TransportAction, withNote?: string) {
    act.mutate({ id: t.id, expectedVersion: t.version, action, note: withNote || undefined }, { onSuccess: () => setPending(null) });
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) run(pending, note);
  }

  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{KIND_LABEL[t.kind]}</span>
        <StatusBadge status={t.status} label={s.label} tone={s.tone} />
        {showRequest && (
          <span className="text-sm text-slate-600">
            <span className="font-mono">{t.request.publicCode}</span> · {t.request.bloodGroup} · {t.facility.name} · due {formatDateTime(t.request.deadlineAt)} (
            {relativeTime(t.request.deadlineAt)})
          </span>
        )}
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline text-slate-500">From: </dt>
          <dd className="inline">
            {t.pickup.label}
            {mapLink(t.pickup.location) && (
              <>
                {' '}
                <a className="text-brand-700 underline" href={mapLink(t.pickup.location)!} target="_blank" rel="noreferrer">
                  map
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-500">To: </dt>
          <dd className="inline">
            {t.dropoff.label}
            {mapLink(t.dropoff.location) && (
              <>
                {' '}
                <a className="text-brand-700 underline" href={mapLink(t.dropoff.location)!} target="_blank" rel="noreferrer">
                  map
                </a>
              </>
            )}
          </dd>
        </div>
        {t.donor && (
          <div>
            <dt className="inline text-slate-500">Donor: </dt>
            <dd className="inline">
              {t.donor.name}
              {t.donor.phone && (
                <>
                  {' · '}
                  <a href={`tel:${t.donor.phone}`} className="text-brand-700 underline">
                    {t.donor.phone}
                  </a>
                </>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="inline text-slate-500">Coordinator: </dt>
          <dd className="inline">{t.assignee?.name ?? 'not yet assigned'}</dd>
        </div>
      </dl>
      {t.note && <p className="text-sm text-slate-700">“{t.note}”</p>}
      {t.history.length > 1 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">History</summary>
          <ol className="mt-1">
            {t.history.map((h, i) => (
              <li key={i}>
                {formatDateTime(h.at)} — {STATUS[h.status].label}
                {h.by && ` by ${h.by}`}
                {h.note && `: “${h.note}”`}
              </li>
            ))}
          </ol>
        </details>
      )}
      <FormError error={act.error} />
      {!pending && t.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {t.allowedActions.map((a) => (
            <button
              key={a}
              type="button"
              disabled={act.isPending}
              className={a === 'fail' || a === 'cancel' ? 'btn-secondary text-red-700' : a === 'claim' || a === 'complete' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                act.reset();
                if (a === 'fail' || a === 'cancel' || a === 'complete') {
                  setNote('');
                  setPending(a);
                } else run(a);
              }}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
      {pending && (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          {pending === 'complete' && <p className="text-sm text-slate-700">Confirm the donor or units actually arrived at your facility.</p>}
          <TextAreaField label={needsNote ? 'Reason' : 'Note (optional)'} required={needsNote} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} error={fieldError(act.error, 'note')} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={act.isPending}>
              {ACTION_LABEL[pending]}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPending(null)}>
              Back
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
