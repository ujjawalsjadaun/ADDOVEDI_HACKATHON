import { useState, type FormEvent } from 'react';
import {
  MAX_ROAD_REPORT_HOURS,
  ROAD_CONDITIONS,
  ROAD_REPORT_CONFIDENCE,
  type LatLng,
  type RoadCondition,
  type RoadReportConfidence,
} from '@golden-hour/shared';
import { fieldError, FormError, SelectField, TextAreaField, TextField } from '../../../components/ui/form';
import { useCreateRoadReport } from '../api';

export const CONDITION_LABEL: Record<RoadCondition, string> = {
  open: 'Open',
  blocked: 'Blocked',
  restricted: 'Restricted (one lane, slow, 4×4 only…)',
  unknown: 'Unknown',
};

const CONFIDENCE_LABEL: Record<RoadReportConfidence, string> = {
  low: 'Low — heard from someone',
  medium: 'Medium — reliable source',
  high: 'High — seen it myself',
};

export function RoadReportForm({ picked, onDone }: { picked: LatLng | null; onDone: () => void }) {
  const create = useCreateRoadReport();
  const [form, setForm] = useState({
    label: '',
    condition: 'blocked' as RoadCondition,
    confidence: 'medium' as RoadReportConfidence,
    expiresInHours: '12',
    note: '',
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    create.mutate(
      {
        location: picked,
        label: form.label,
        condition: form.condition,
        confidence: form.confidence,
        expiresInHours: Number(form.expiresInHours),
        note: form.note || undefined,
      },
      { onSuccess: onDone },
    );
  }

  const err = create.error;
  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h3 className="font-semibold">Report a road condition</h3>
      <p className="text-sm text-slate-600">
        {picked ? (
          <>
            Location: <span className="font-mono">{picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}</span> — click the map to move it.
          </>
        ) : (
          <strong>Click the map where the road condition is.</strong>
        )}
      </p>
      <FormError error={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Place"
          placeholder="e.g. Km 14 landslide, Siang Hills road"
          required
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          error={fieldError(err, 'label')}
        />
        <SelectField
          label="Condition"
          value={form.condition}
          onChange={(e) => setForm({ ...form, condition: e.target.value as RoadCondition })}
          options={ROAD_CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
        />
        <SelectField
          label="How sure are you?"
          value={form.confidence}
          onChange={(e) => setForm({ ...form, confidence: e.target.value as RoadReportConfidence })}
          options={ROAD_REPORT_CONFIDENCE.map((c) => ({ value: c, label: CONFIDENCE_LABEL[c] }))}
          hint="A blocked road changes travel times only if verified or reported with high confidence."
        />
        <SelectField
          label="Treat as current for"
          value={form.expiresInHours}
          onChange={(e) => setForm({ ...form, expiresInHours: e.target.value })}
          options={[2, 6, 12, 24, 48, MAX_ROAD_REPORT_HOURS].map((h) => ({ value: String(h), label: `${h} hours` }))}
          hint="After this it is shown as stale and ignored."
        />
      </div>
      <TextAreaField label="Details (optional)" maxLength={280} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={!picked || create.isPending}>
          {create.isPending ? 'Saving…' : 'Submit report'}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
