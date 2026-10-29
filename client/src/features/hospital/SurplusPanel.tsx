import { useState, type FormEvent } from 'react';
import { BLOOD_GROUPS, type BloodGroup, type SurplusOfferView } from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextField } from '../../components/ui/form';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime, relativeTime } from '../../lib/format';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useCreateStockTransfer, useCreateSurplus, useSurplus, useWithdrawSurplus } from './api';

/**
 * Spare units that verified facilities are willing to share, so surplus is used instead of wasted.
 * An offer is information; asking for the units creates a normal stock transfer that the offering facility answers.
 */
export function SurplusPanel() {
  const q = useSurplus();
  const [adding, setAdding] = useState(false);

  return (
    <section className="card space-y-3 border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Surplus units nearby</h3>
          <p className="text-xs text-slate-500">Spare units facilities have offered. Ask for them here, or share your own surplus before it expires.</p>
        </div>
        <button type="button" className="btn-secondary text-xs min-h-9 py-1.5" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
          {adding ? 'Close form' : 'Share our surplus'}
        </button>
      </div>
      {adding && <OfferForm onDone={() => setAdding(false)} />}
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title="No surplus offered right now" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {q.data!.map((o) => (
            <OfferRow key={o.id} offer={o} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OfferRow({ offer }: { offer: SurplusOfferView }) {
  const withdraw = useWithdrawSurplus();
  const request = useCreateStockTransfer();
  const [units, setUnits] = useState('1');
  const [key] = useState(newIdempotencyKey);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">
          <span className="mr-2 rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-brand-700">{offer.bloodGroup}</span>
          {offer.units} unit{offer.units === 1 ? '' : 's'} · {offer.facility.name}
          {offer.own && <span className="ml-2 text-2xs font-semibold text-slate-500">(yours)</span>}
        </p>
        <p className="text-2xs text-slate-500">
          {offer.facility.district} · offered until {formatDateTime(offer.availableUntil)} ({relativeTime(offer.availableUntil)}){offer.note && ` · ${offer.note}`}
        </p>
        <FormError error={request.error ?? withdraw.error} />
        {request.isSuccess && <p role="status" className="text-xs font-semibold text-emerald-800">Requested. Track it under Outgoing transfers.</p>}
      </div>
      {offer.own ? (
        <button type="button" className="btn-secondary text-xs" disabled={withdraw.isPending} onClick={() => withdraw.mutate(offer.id)}>
          Withdraw
        </button>
      ) : (
        !request.isSuccess && (
          <div className="flex items-center gap-2">
            <select className="input w-16" aria-label="Units to request" value={units} onChange={(e) => setUnits(e.target.value)}>
              {Array.from({ length: Math.min(offer.units, 12) }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={request.isPending}
              onClick={() =>
                request.mutate({
                  input: { respondingFacilityId: offer.facility.id, bloodGroup: offer.bloodGroup, units: Number(units), note: 'Requested from a surplus offer' },
                  idempotencyKey: key,
                })
              }
            >
              Request
            </button>
          </div>
        )
      )}
    </li>
  );
}

function OfferForm({ onDone }: { onDone: () => void }) {
  const create = useCreateSurplus();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [units, setUnits] = useState('1');
  const [validHours, setValidHours] = useState('48');
  const [note, setNote] = useState('');
  const err = create.error;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ bloodGroup, units: Number(units), validHours: Number(validHours), note: note || undefined }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3" noValidate>
      <FormError error={err} />
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label="Blood group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
        <TextField label="Spare units" type="number" min={1} max={50} value={units} onChange={(e) => setUnits(e.target.value)} error={fieldError(err, 'units')} />
        <TextField label="Offer open for (hours)" type="number" min={6} max={168} value={validHours} onChange={(e) => setValidHours(e.target.value)} error={fieldError(err, 'validHours')} hint="Use a short window for units close to expiry." />
      </div>
      <TextField label="Note (optional)" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} error={fieldError(err, 'note')} />
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Share surplus'}
      </button>
    </form>
  );
}
