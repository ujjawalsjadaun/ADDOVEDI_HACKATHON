import { useState, type FormEvent } from 'react';
import type { RequestDetail, TransportKind } from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { useCreateTransportTask, useTransportTasks } from './api';
import { TransportTaskCard } from './components/TransportTaskCard';

/** Transport for one request (request detail page). Transport progress never changes the request's state. */
export function TransportPanel({ request }: { request: RequestDetail }) {
  const [creating, setCreating] = useState(false);
  const q = useTransportTasks({ requestId: request.id, scope: 'all' });
  const canCreate = request.verificationStatus === 'verified' && request.requestStatus !== 'closed';
  if (!canCreate && (q.data?.length ?? 0) === 0) return null;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Transport</h3>
        {canCreate && (
          <button type="button" className="btn-secondary" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
            {creating ? 'Close form' : 'Request transport'}
          </button>
        )}
      </div>
      {creating && <CreateTransportForm request={request} onDone={() => setCreating(false)} />}
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <p className="text-sm text-slate-600">No transport arranged. Coordinators can pick up a donor or move units if you request it.</p>
      ) : (
        <ul className="space-y-2">
          {q.data!.map((t) => (
            <TransportTaskCard key={t.id} task={t} showRequest={false} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateTransportForm({ request, onDone }: { request: RequestDetail; onDone: () => void }) {
  const create = useCreateTransportTask();
  const activeDonors = request.assignments.filter((a) => ['accepted', 'en_route'].includes(a.status));
  const [kind, setKind] = useState<TransportKind>(activeDonors.length > 0 ? 'donor_pickup' : 'unit_transfer');
  const [assignmentId, setAssignmentId] = useState(activeDonors[0]?.id ?? '');
  const donor = activeDonors.find((a) => a.id === assignmentId);
  const [pickup, setPickup] = useState(donor?.donor.anchorLabel ?? '');
  const [dropoff, setDropoff] = useState(request.facility.name);
  const [note, setNote] = useState('');
  const [relay, setRelay] = useState(false);
  const [relayPoint, setRelayPoint] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        requestId: request.id,
        kind,
        assignmentId: kind === 'donor_pickup' ? assignmentId || undefined : undefined,
        pickup: { label: pickup },
        dropoff: { label: dropoff },
        relayPoint: kind === 'donor_pickup' && relay ? { label: relayPoint } : undefined,
        note: note || undefined,
      },
      { onSuccess: onDone },
    );
  }

  const err = create.error;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3" noValidate>
      <FormError error={err} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="What"
          value={kind}
          onChange={(e) => setKind(e.target.value as TransportKind)}
          options={[
            { value: 'donor_pickup', label: 'Pick up a donor' },
            { value: 'unit_transfer', label: 'Move blood units' },
          ]}
        />
        {kind === 'donor_pickup' && (
          <SelectField
            label="Donor"
            value={assignmentId}
            onChange={(e) => {
              setAssignmentId(e.target.value);
              setPickup(activeDonors.find((a) => a.id === e.target.value)?.donor.anchorLabel ?? '');
            }}
            options={
              activeDonors.length
                ? activeDonors.map((a) => ({ value: a.id, label: `${a.donor.name}${a.donor.anchorLabel ? ` (${a.donor.anchorLabel})` : ''}` }))
                : [{ value: '', label: 'No donor is on the way yet' }]
            }
            error={fieldError(err, 'assignmentId')}
          />
        )}
        <TextField label="From" required value={pickup} onChange={(e) => setPickup(e.target.value)} error={fieldError(err, 'pickup.label')} placeholder="Village, landmark or facility" />
        <TextField label="To" required value={dropoff} onChange={(e) => setDropoff(e.target.value)} error={fieldError(err, 'dropoff.label')} />
      </div>
      {kind === 'donor_pickup' && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={relay} onChange={(e) => setRelay(e.target.checked)} />
            Relay: hand the donor over to a second coordinator (e.g. across a river or ridge)
          </label>
          {relay && (
            <TextField label="Handover point" required value={relayPoint} onChange={(e) => setRelayPoint(e.target.value)} error={fieldError(err, 'relayPoint.label')} placeholder="Where the two coordinators meet" />
          )}
        </div>
      )}
      <TextAreaField label="Instructions (optional)" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Request transport'}
      </button>
    </form>
  );
}
