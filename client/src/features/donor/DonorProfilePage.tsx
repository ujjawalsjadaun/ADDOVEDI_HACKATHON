import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { BLOOD_GROUPS, type BloodGroup, type DonorProfileView } from '@golden-hour/shared';
import { CheckboxField, fieldError, FormError, SelectField, TextField } from '../../components/ui/form';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useDonorProfile, useLastDonationUnknown, useUpdateDonorProfile } from './api';

export function DonorProfilePage() {
  const profile = useDonorProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  return <ProfileForm key={profile.data.consent.at + profile.data.bloodGroup} profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: DonorProfileView }) {
  const location = useLocation();
  const welcome = (location.state as { welcome?: boolean } | null)?.welcome;
  const save = useUpdateDonorProfile();
  const unknown = useLastDonationUnknown();
  const [saved, setSaved] = useState(false);
  const [geoError, setGeoError] = useState<string>();
  const [form, setForm] = useState({
    bloodGroup: profile.bloodGroup,
    donated: profile.lastDonationKnown ? (profile.lastDonationOn ? 'yes' : 'never') : 'yes',
    lastDonationOn: profile.lastDonationOn ?? '',
    anchorLabel: profile.anchorLabel ?? '',
    lat: profile.anchor ? String(profile.anchor.lat) : '',
    lng: profile.anchor ? String(profile.anchor.lng) : '',
    contact: profile.consent.contact,
    location: profile.consent.location,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  function useMyLocation() {
    setGeoError(undefined);
    if (!navigator.geolocation) {
      setGeoError('Your browser cannot share location. Enter it manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', pos.coords.latitude.toFixed(4));
        set('lng', pos.coords.longitude.toFixed(4));
      },
      () => setGeoError('Location permission was denied. Enter it manually.'),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hasCoordinates = form.lat.trim() !== '' && form.lng.trim() !== '';
    const anchor = form.location && hasCoordinates ? { lat: Number(form.lat), lng: Number(form.lng), label: form.anchorLabel } : null;
    save.mutate(
      {
        bloodGroup: form.bloodGroup,
        lastDonationOn: form.donated === 'never' ? null : form.lastDonationOn,
        anchor,
        consent: { contact: form.contact, location: form.location },
      },
      { onSuccess: () => setSaved(true) },
    );
  }

  const err = save.error;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {welcome && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Welcome! Complete your profile below. An administrator will verify it before you receive alerts.
        </p>
      )}
      <section className="card">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{profile.name}</h1>
          <StatusBadge status={profile.verificationStatus} tone={profile.verificationStatus === 'verified' ? 'green' : 'amber'} />
          {profile.reviewStatus === 'under_review' && <StatusBadge status="under_review" label="under review" tone="red" />}
        </div>
        <p className="text-sm text-slate-600">
          {profile.email}
          {profile.phone && ` · ${profile.phone}`}
          {profile.nextEligibleOn && ` · rest period ends ${profile.nextEligibleOn}`}
          {profile.strikesLast180Days > 0 && ` · ${profile.strikesLast180Days} missed donation(s) in 180 days`}
        </p>
      </section>

      <form onSubmit={onSubmit} className="card space-y-5" noValidate>
        <FormError error={err} />
        {saved && (
          <p role="status" className="text-sm text-emerald-800">
            Saved.
          </p>
        )}

        <SelectField
          label="Blood group"
          value={form.bloodGroup}
          onChange={(e) => set('bloodGroup', e.target.value as BloodGroup)}
          options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
          hint={form.bloodGroup !== profile.bloodGroup ? 'Changing your blood group needs re-verification before you get alerts.' : undefined}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">Last blood donation</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="donated" checked={form.donated === 'yes'} onChange={() => set('donated', 'yes')} /> On this date
          </label>
          {form.donated === 'yes' && (
            <div className="max-w-xs pl-6">
              <TextField
                label="Date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.lastDonationOn}
                onChange={(e) => set('lastDonationOn', e.target.value)}
                error={fieldError(err, 'lastDonationOn')}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="donated" checked={form.donated === 'never'} onChange={() => set('donated', 'never')} /> I have never donated
          </label>
          <p className="text-xs text-slate-500">
            Don't remember?{' '}
            <button type="button" className="underline" disabled={unknown.isPending} onClick={() => unknown.mutate()}>
              Mark it as unknown
            </button>{' '}
            — hospitals will then review you manually instead of alerting you automatically.
            {!profile.lastDonationKnown && <strong> Currently marked unknown.</strong>}
          </p>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Approximate location</legend>
          <CheckboxField
            label="Use my approximate location to estimate travel time"
            hint="Rounded to about 1 km. Never shown to the public; hospitals see only the place name below."
            checked={form.location}
            onChange={(e) => set('location', e.target.checked)}
          />
          {form.location && (
            <>
              <TextField
                label="Village / locality"
                value={form.anchorLabel}
                onChange={(e) => set('anchorLabel', e.target.value)}
                error={fieldError(err, 'anchor.label')}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <TextField label="Latitude" inputMode="decimal" value={form.lat} onChange={(e) => set('lat', e.target.value)} error={fieldError(err, 'anchor.lat')} />
                <TextField label="Longitude" inputMode="decimal" value={form.lng} onChange={(e) => set('lng', e.target.value)} error={fieldError(err, 'anchor.lng')} />
                <button type="button" className="btn-secondary" onClick={useMyLocation}>
                  Use my location
                </button>
              </div>
              {geoError && <p className="text-xs text-red-700">{geoError}</p>}
              <p className="text-xs text-slate-500">Saved coordinates are rounded to about 1 km.</p>
            </>
          )}
        </fieldset>

        <CheckboxField
          label="Hospitals may contact me when my blood group is needed"
          hint="Turning this off stops all alerts. It does not cancel a donation you already accepted."
          checked={form.contact}
          onChange={(e) => set('contact', e.target.checked)}
        />

        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
