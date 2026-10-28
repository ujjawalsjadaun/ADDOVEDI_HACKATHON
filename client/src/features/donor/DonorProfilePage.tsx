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
    <div className="mx-auto max-w-2xl space-y-5">
      {welcome && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-xs">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-emerald-950">Welcome to Golden Hour Volunteer Network</p>
            <p className="text-xs text-emerald-800 mt-0.5">Please complete your clinical eligibility profile below. An administrator will verify your profile before you receive dispatch alerts.</p>
          </div>
        </div>
      )}
      <section className="card space-y-3 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 font-bold text-base">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{profile.name}</h1>
                <StatusBadge status={profile.verificationStatus} tone={profile.verificationStatus === 'verified' ? 'green' : 'amber'} />
                {profile.reviewStatus === 'under_review' && <StatusBadge status="under_review" label="under review" tone="red" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-medium mt-0.5">
                <span>{profile.email}</span>
                {profile.phone && (
                  <>
                    <span>·</span>
                    <span>{profile.phone}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center rounded-lg bg-brand-50 px-3 py-1 font-mono text-base font-bold text-brand-700 border border-brand-200">
            {profile.bloodGroup}
          </span>
        </div>

        {(profile.nextEligibleOn || profile.strikesLast180Days > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-2xs">
            {profile.nextEligibleOn && (
              <span className="rounded-md bg-blue-50 px-2.5 py-1 font-medium text-blue-700 border border-blue-200">
                Rest period ends: {profile.nextEligibleOn}
              </span>
            )}
            {profile.strikesLast180Days > 0 && (
              <span className="rounded-md bg-rose-50 px-2.5 py-1 font-medium text-rose-700 border border-rose-200">
                {profile.strikesLast180Days} missed donation(s) in last 180 days
              </span>
            )}
          </div>
        )}
      </section>

      <form onSubmit={onSubmit} className="card space-y-6 border-slate-200 shadow-sm" noValidate>
        <FormError error={err} />
        {saved && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Profile changes saved successfully.
          </div>
        )}

        <SelectField
          label="Blood group"
          value={form.bloodGroup}
          onChange={(e) => set('bloodGroup', e.target.value as BloodGroup)}
          options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
          hint={form.bloodGroup !== profile.bloodGroup ? 'Changing your blood group needs re-verification before you get alerts.' : undefined}
        />

        <fieldset className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-700">Last blood donation history</legend>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input type="radio" name="donated" checked={form.donated === 'yes'} onChange={() => set('donated', 'yes')} className="text-brand-600 focus:ring-brand-500" /> On this date
          </label>
          {form.donated === 'yes' && (
            <div className="max-w-xs pl-6">
              <TextField
                label="Donation Date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.lastDonationOn}
                onChange={(e) => set('lastDonationOn', e.target.value)}
                error={fieldError(err, 'lastDonationOn')}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input type="radio" name="donated" checked={form.donated === 'never'} onChange={() => set('donated', 'never')} className="text-brand-600 focus:ring-brand-500" /> I have never donated
          </label>
          <p className="text-2xs text-slate-500 pt-1 border-t border-slate-200/60">
            Don't remember?{' '}
            <button type="button" className="font-semibold text-brand-700 underline" disabled={unknown.isPending} onClick={() => unknown.mutate()}>
              Mark it as unknown
            </button>{' '}
            — hospitals will then review you manually instead of alerting you automatically.
            {!profile.lastDonationKnown && <strong className="text-amber-800"> Currently marked unknown.</strong>}
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-700">Approximate location &amp; routing</legend>
          <CheckboxField
            label="Use my approximate location to estimate travel time"
            hint="Rounded to ~1 km centroid for privacy. Never exposed publicly; dispatch calculates ETA only."
            checked={form.location}
            onChange={(e) => set('location', e.target.checked)}
          />
          {form.location && (
            <div className="space-y-3 pt-2 border-t border-slate-200/60">
              <TextField
                label="Village / locality name"
                placeholder="e.g. Indiranagar, Sector 4"
                value={form.anchorLabel}
                onChange={(e) => set('anchorLabel', e.target.value)}
                error={fieldError(err, 'anchor.label')}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <TextField label="Latitude" inputMode="decimal" placeholder="12.9716" value={form.lat} onChange={(e) => set('lat', e.target.value)} error={fieldError(err, 'anchor.lat')} />
                <TextField label="Longitude" inputMode="decimal" placeholder="77.5946" value={form.lng} onChange={(e) => set('lng', e.target.value)} error={fieldError(err, 'anchor.lng')} />
                <button type="button" className="btn-secondary text-xs min-h-10" onClick={useMyLocation}>
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Detect GPS
                </button>
              </div>
              {geoError && <p className="text-xs text-rose-700">{geoError}</p>}
              <p className="text-2xs text-slate-500">Coordinates are permanently truncated to 1 km precision.</p>
            </div>
          )}
        </fieldset>

        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <CheckboxField
            label="Hospitals may contact me when my blood group is needed"
            hint="Turning this off pauses dispatch alerts. It does not cancel an accepted emergency in progress."
            checked={form.contact}
            onChange={(e) => set('contact', e.target.checked)}
          />
        </div>

        <button type="submit" className="btn-primary min-h-11 px-6" disabled={save.isPending}>
          {save.isPending ? 'Saving changes…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
