import { useState, type FormEvent } from 'react';
import { BLOOD_GROUPS, type BloodGroup, type StockTransferAction, type StockTransferView } from '@golden-hour/shared';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge, type BadgeTone } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../lib/format';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useMe } from '../auth/api';
import { SurplusPanel } from './SurplusPanel';
import { useCreateStockTransfer, useRequests, useStockTransferAction, useStockTransfers, useVerifiedFacilities } from './api';

const STATUS_TONE: Record<StockTransferView['status'], BadgeTone> = {
  requested: 'amber',
  offered: 'blue',
  dispatched: 'blue',
  received: 'green',
  declined: 'slate',
  cancelled: 'slate',
};

const ACTION_LABEL: Record<StockTransferAction, string> = {
  offer: 'Offer units',
  decline: 'Decline',
  dispatch: 'Mark dispatched',
  receive: 'Confirm received',
  cancel: 'Cancel request',
};

/**
 * Facility-to-facility stock requests. Receiving stock does not close any blood request —
 * the hospital still confirms fulfilment on the request itself.
 */
export function StockTransfersPage() {
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [creating, setCreating] = useState(false);
  const q = useStockTransfers(direction);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Stock transfers</h2>
          <p className="text-xs text-slate-500">Request emergency blood units from verified facilities or blood banks, or respond to inbound requests.</p>
        </div>
        <button type="button" className="btn-primary text-xs min-h-9 py-1.5" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={creating ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          {creating ? 'Close form' : 'Request stock'}
        </button>
      </div>
      {creating && <CreateTransferForm onDone={() => setCreating(false)} />}
      <SurplusPanel />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Direction" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          {(['outgoing', 'incoming'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                direction === d
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {d === 'outgoing' ? 'We requested' : 'Requested from us'}
            </button>
          ))}
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title="No stock transfers" />
      ) : (
        <ul className="space-y-3.5">
          {q.data!.map((t) => (
            <TransferRow key={t.id} transfer={t} direction={direction} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TransferRow({ transfer: t, direction }: { transfer: StockTransferView; direction: 'outgoing' | 'incoming' }) {
  const act = useStockTransferAction();
  const [pending, setPending] = useState<StockTransferAction | null>(null);
  const [offered, setOffered] = useState(String(t.units));
  const [note, setNote] = useState('');
  const other = direction === 'outgoing' ? t.responding : t.requesting;
  const needsNote = pending === 'decline' || pending === 'cancel';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    act.mutate(
      { id: t.id, expectedVersion: t.version, action: pending, offeredUnits: pending === 'offer' ? Number(offered) : undefined, note: note || undefined },
      { onSuccess: () => setPending(null) },
    );
  }

  return (
    <li className="card space-y-3 border-slate-200 hover:border-slate-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-2xs font-bold text-brand-700 border border-brand-200">
            {t.bloodGroup}
          </span>
          <span className="font-bold text-slate-900">
            {t.units} unit(s) {direction === 'outgoing' ? 'from' : 'for'} {other.name}
          </span>
          <StatusBadge status={t.status} tone={STATUS_TONE[t.status]} />
          {t.offeredUnits !== null && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700">
              {t.offeredUnits} offered
            </span>
          )}
          {t.relatedRequest && (
            <span className="font-mono text-2xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
              for {t.relatedRequest.publicCode}
            </span>
          )}
        </div>
      </div>
      {t.note && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs text-slate-700 italic">
          “{t.note}”
        </div>
      )}
      <ol className="text-2xs text-slate-400 space-y-0.5 pl-2 border-l-2 border-slate-100">
        {t.history.map((h, i) => (
          <li key={i}>
            <span className="font-medium text-slate-600">{formatDateTime(h.at)}</span> — {h.status}
            {h.by && ` by ${h.by}`}
            {h.note && `: “${h.note}”`}
          </li>
        ))}
      </ol>
      <FormError error={act.error} />
      {!pending && t.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {t.allowedActions.map((a) => (
            <button
              key={a}
              type="button"
              className={
                a === 'decline' || a === 'cancel'
                  ? 'btn-secondary text-xs min-h-8 py-1 px-3 text-rose-700 hover:text-rose-800 hover:border-rose-200'
                  : 'btn-secondary text-xs min-h-8 py-1 px-3'
              }
              onClick={() => {
                act.reset();
                setNote('');
                setPending(a);
              }}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
      {pending && (
        <form onSubmit={submit} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          {pending === 'offer' && (
            <TextField label="Units you can send" type="number" min={1} max={t.units} value={offered} onChange={(e) => setOffered(e.target.value)} error={fieldError(act.error, 'offeredUnits')} />
          )}
          {pending === 'receive' && <p className="text-sm text-slate-700">Confirm the units physically arrived. This does not close any blood request.</p>}
          <TextAreaField
            label={needsNote ? 'Reason' : 'Note (optional)'}
            required={needsNote}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={fieldError(act.error, 'note')}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={act.isPending}>
              {act.isPending ? 'Saving…' : ACTION_LABEL[pending]}
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

function CreateTransferForm({ onDone }: { onDone: () => void }) {
  const me = useMe();
  const facilities = useVerifiedFacilities();
  const requests = useRequests({ active: 'true', limit: 50 });
  const create = useCreateStockTransfer();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [form, setForm] = useState({ respondingFacilityId: '', bloodGroup: 'O+' as BloodGroup, units: '1', relatedRequestId: '', note: '' });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setIdempotencyKey(newIdempotencyKey());
  };
  const targets = (facilities.data ?? []).filter((f) => f.id !== me.data?.user.facilityId);

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        idempotencyKey,
        input: {
          respondingFacilityId: form.respondingFacilityId,
          bloodGroup: form.bloodGroup,
          units: Number(form.units),
          relatedRequestId: form.relatedRequestId || undefined,
          note: form.note || undefined,
        },
      },
      { onSuccess: onDone },
    );
  }

  const err = create.error;
  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <h3 className="font-semibold">Request stock from another facility</h3>
      <p className="text-sm text-slate-600">There is no live inventory feed — the other facility confirms what it can send.</p>
      <FormError error={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Ask"
          value={form.respondingFacilityId}
          onChange={(e) => set('respondingFacilityId', e.target.value)}
          options={[{ value: '', label: facilities.isPending ? 'Loading…' : 'Choose a facility' }, ...targets.map((f) => ({ value: f.id, label: `${f.name} (${f.district})` }))]}
          error={fieldError(err, 'respondingFacilityId')}
        />
        <SelectField label="Blood group" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value as BloodGroup)} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
        <TextField label="Units" type="number" min={1} max={12} value={form.units} onChange={(e) => set('units', e.target.value)} error={fieldError(err, 'units')} />
        <SelectField
          label="For request (optional)"
          value={form.relatedRequestId}
          onChange={(e) => set('relatedRequestId', e.target.value)}
          options={[{ value: '', label: 'Not linked' }, ...(requests.data?.data ?? []).map((r) => ({ value: r.id, label: `${r.publicCode} · ${r.bloodGroup}` }))]}
          error={fieldError(err, 'relatedRequestId')}
        />
      </div>
      <TextAreaField label="Note (optional)" maxLength={280} value={form.note} onChange={(e) => set('note', e.target.value)} />
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}
