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
    <li className="card space-y-3.5 border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{KIND_LABEL[t.kind]}</span>
          <StatusBadge status={t.status} label={s.label} tone={s.tone} />
          {t.relay && (
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-2xs font-bold text-brand-700 ring-1 ring-brand-700/20">
              Relay leg {t.relay.leg} of 2 · handover at {t.relay.handoverPoint}
            </span>
          )}
          {showRequest && (
            <span className="text-xs text-slate-500 font-medium">
              <span className="font-mono font-bold text-slate-700">{t.request.publicCode}</span> · {t.request.bloodGroup} · {t.facility.name}
            </span>
          )}
        </div>
        {showRequest && (
          <span className="text-2xs text-slate-500 font-medium">
            Due {formatDateTime(t.request.deadlineAt)} ({relativeTime(t.request.deadlineAt)})
          </span>
        )}
      </div>

      {t.relay?.leg === 2 && !['handed_over', 'completed'].includes(t.relay.otherLegStatus ?? '') && ['requested', 'assigned'].includes(t.status) && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-900">Waiting for the first leg to reach the handover point before this leg can start.</p>
      )}
      <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-2xs uppercase tracking-wider text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Pickup Origin
          </div>
          <div className="font-medium text-slate-800 pl-3.5">
            {t.pickup.label}
            {mapLink(t.pickup.location) && (
              <a className="ml-1.5 font-semibold text-brand-700 hover:underline" href={mapLink(t.pickup.location)!} target="_blank" rel="noreferrer">
                Map ↗
              </a>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-2xs uppercase tracking-wider text-slate-500">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Destination Drop-off
          </div>
          <div className="font-medium text-slate-800 pl-3.5">
            {t.dropoff.label}
            {mapLink(t.dropoff.location) && (
              <a className="ml-1.5 font-semibold text-brand-700 hover:underline" href={mapLink(t.dropoff.location)!} target="_blank" rel="noreferrer">
                Map ↗
              </a>
            )}
          </div>
        </div>

        {t.donor && (
          <div className="space-y-0.5 text-xs">
            <span className="font-bold text-2xs uppercase tracking-wider text-slate-500">Donor Contact: </span>
            <span className="font-semibold text-slate-900">{t.donor.name}</span>
            {t.donor.phone && (
              <a href={`tel:${t.donor.phone}`} className="ml-1.5 font-semibold text-brand-700 hover:underline">
                {t.donor.phone}
              </a>
            )}
          </div>
        )}

        <div className="space-y-0.5 text-xs">
          <span className="font-bold text-2xs uppercase tracking-wider text-slate-500">Coordinator: </span>
          <span className="font-semibold text-slate-800">{t.assignee?.name ?? 'Not yet assigned'}</span>
        </div>
      </div>

      {t.note && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs text-slate-700 italic">
          “{t.note}”
        </div>
      )}

      {t.history.length > 1 && (
        <details className="text-2xs text-slate-500">
          <summary className="cursor-pointer font-medium hover:text-slate-800">Tracking milestones ({t.history.length})</summary>
          <ol className="mt-2 space-y-1 pl-3 border-l-2 border-slate-200">
            {t.history.map((h, i) => (
              <li key={i}>
                <span className="font-medium text-slate-700">{formatDateTime(h.at)}</span> — {STATUS[h.status].label}
                {h.by && ` by ${h.by}`}
                {h.note && `: “${h.note}”`}
              </li>
            ))}
          </ol>
        </details>
      )}

      <FormError error={act.error} />

      {!pending && t.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {t.allowedActions.map((a) => (
            <button
              key={a}
              type="button"
              disabled={act.isPending}
              className={
                a === 'fail' || a === 'cancel'
                  ? 'btn-secondary text-xs min-h-9 py-1.5 text-rose-700 hover:text-rose-800 hover:border-rose-200 hover:bg-rose-50/60'
                  : a === 'claim' || a === 'complete'
                  ? 'btn-primary text-xs min-h-9 py-1.5'
                  : 'btn-secondary text-xs min-h-9 py-1.5'
              }
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
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {pending === 'complete' && <p className="text-xs font-semibold text-slate-800">Confirm the donor or units safely arrived at your facility.</p>}
          <TextAreaField label={needsNote ? 'Reason' : 'Note (optional)'} required={needsNote} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} error={fieldError(act.error, 'note')} />
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary text-xs min-h-9 py-1.5" disabled={act.isPending}>
              {ACTION_LABEL[pending]}
            </button>
            <button type="button" className="btn-secondary text-xs min-h-9 py-1.5" onClick={() => setPending(null)}>
              Back
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
