import { useState, type FormEvent } from 'react';
import type { LatLng, MapFacility } from '@golden-hour/shared';
import { FormError, SelectField, TextField } from '../../../components/ui/form';
import { useSetAccessPoint } from '../api';

/** Sets the nearest point an ambulance/vehicle can reach for a facility (a reported estimate). */
export function AccessPointForm({
  facilities,
  picked,
  onDone,
}: {
  facilities: MapFacility[];
  picked: LatLng | null;
  onDone: () => void;
}) {
  const save = useSetAccessPoint();
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '');
  const [note, setNote] = useState('');
  const facility = facilities.find((f) => f.id === facilityId);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!picked || !facilityId) return;
    save.mutate({ facilityId, location: picked, note: note || undefined }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h3 className="font-semibold">Set vehicle access point</h3>
      <p className="text-sm text-slate-600">
        The nearest point a vehicle or ambulance can reach for this facility, shown to coordinators and donors as a reported estimate.{' '}
        {picked ? (
          <span className="font-mono">
            {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
          </span>
        ) : (
          <strong>Click the map to choose it.</strong>
        )}
      </p>
      <FormError error={save.error} />
      {facilities.length > 1 && (
        <SelectField
          label="Facility"
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          options={facilities.map((f) => ({ value: f.id, label: `${f.name} (${f.district})` }))}
        />
      )}
      <TextField label="Note (optional)" placeholder="e.g. road ends at the bridge; 300 m on foot" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={!picked || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save access point'}
        </button>
        {facility?.accessPoint && (
          <button
            type="button"
            className="btn-secondary text-red-700"
            disabled={save.isPending}
            onClick={() => save.mutate({ facilityId, location: null }, { onSuccess: onDone })}
          >
            Clear current point
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
