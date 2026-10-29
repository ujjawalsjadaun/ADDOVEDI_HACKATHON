// npm run seed -w server
// Fills an EMPTY or existing development database with FICTIONAL demo data. Safe to re-run: anything that
// already exists (matched by email / facility name / patient reference) is left untouched.
// Refuses to run when NODE_ENV=production. Never use real names, numbers or patients here.

import { DONOR_CONSENT_VERSION, suggestUrgency, type BloodGroup } from '@golden-hour/shared';
import { hmacHex } from '../lib/crypto';
import { coarsen, toGeoPoint } from '../lib/geo';
import { ensureIndexes } from '../lib/indexes';
import { generatePublicCode } from '../lib/ids';
import { recordAudit } from '../modules/audit/audit.service';
import { hashPassword } from '../modules/auth/password';
import { DonorProfileModel } from '../modules/donors/donor.model';
import { HospitalModel } from '../modules/hospitals/hospital.model';
import { BloodRequestModel } from '../modules/requests/request.model';
import { UserModel } from '../modules/users/user.model';
import { bootstrap, shutdown } from './cli';

const config = await bootstrap();
if (config.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data when NODE_ENV=production.');
  await shutdown(1);
}

/** Fictional password for every demo account. Printed at the end; change nothing real to match it. */
const DEMO_PASSWORD = 'DemoPass#2026!';
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const passwordHash = await hashPassword(DEMO_PASSWORD);
await ensureIndexes();

const created: string[] = [];
const skipped: string[] = [];

// ── facilities (fictional "Siang Hills" district) ────────────────────────────

const FACILITIES = [
  { key: 'a', name: 'Siang Hills District Hospital', type: 'hospital_with_blood_bank', lat: 28.0667, lng: 95.326, phone: '+919000000101', status: 'verified', address: 'Hospital Road, Pasighat (fictional)' },
  { key: 'b', name: 'Ridge Community Health Centre', type: 'hospital', lat: 28.2, lng: 95.1, phone: '+919000000102', status: 'verified', address: 'Ridge Village (fictional)' },
  { key: 'c', name: 'Upper Valley Blood Bank', type: 'blood_bank', lat: 28.35, lng: 94.9, phone: '+919000000103', status: 'pending', address: 'Valley Road (fictional)' },
] as const;

// The admin is needed as the "verified by" reference; create it first if missing.
async function adminId() {
  const found = await UserModel.findOne({ email: 'admin@demo.test' });
  if (found) return found._id;
  const doc = await UserModel.create({ email: 'admin@demo.test', name: 'Demo Admin', passwordHash, role: 'admin', phone: '+919000000001' });
  created.push('user admin@demo.test (admin)');
  return doc._id;
}
const adminUserId = (await adminId())!;

const facilityId: Record<string, string> = {};
for (const f of FACILITIES) {
  const existing = await HospitalModel.findOne({ name: f.name });
  if (existing) {
    facilityId[f.key] = existing._id.toString();
    skipped.push(`facility ${f.name}`);
    continue;
  }
  const doc = await HospitalModel.create({
    name: f.name,
    facilityType: f.type,
    district: 'Siang Hills',
    address: f.address,
    location: toGeoPoint({ lat: f.lat, lng: f.lng }),
    registeredPhone: f.phone,
    verificationStatus: f.status,
    ...(f.status === 'verified' && { verification: { by: adminUserId, at: new Date(), reason: 'Demo data (fictional)' } }),
  });
  facilityId[f.key] = doc._id.toString();
  created.push(`facility ${f.name} (${f.status})`);
}


// ── staff, coordinator ───────────────────────────────────────────────────────

const STAFF = [
  { email: 'staff.a@demo.test', name: 'Asha Staff', phone: '+919000000201', facility: 'a', verifier: false },
  { email: 'verifier.a@demo.test', name: 'Vikram Verifier', phone: '+919000000202', facility: 'a', verifier: true },
  { email: 'verifier.b@demo.test', name: 'Bina Verifier', phone: '+919000000203', facility: 'b', verifier: true },
] as const;

for (const s of STAFF) {
  if (await UserModel.exists({ email: s.email })) {
    skipped.push(`user ${s.email}`);
    continue;
  }
  await UserModel.create({
    email: s.email,
    name: s.name,
    passwordHash,
    role: 'hospital_staff',
    phone: s.phone,
    facilityId: facilityId[s.facility],
    canVerifyRequests: s.verifier,
  });
  created.push(`user ${s.email} (hospital staff${s.verifier ? ', verifier' : ''})`);
}
if (!(await UserModel.exists({ email: 'coord@demo.test' }))) {
  await UserModel.create({ email: 'coord@demo.test', name: 'Chimi Coordinator', passwordHash, role: 'coordinator', phone: '+919000000301', villageLabel: 'Mebo village' });
  created.push('user coord@demo.test (coordinator, serves Mebo village)');
} else {
  // Earlier seeds had no village; give the demo coordinator one so the village-relay screen has donors to show.
  const set = await UserModel.updateOne({ email: 'coord@demo.test', villageLabel: null }, { $set: { villageLabel: 'Mebo village' } });
  if (set.modifiedCount) created.push('coord@demo.test now serves Mebo village');
  else skipped.push('user coord@demo.test');
}

// ── donors (varied on purpose: some are NOT alertable) ───────────────────────

interface DemoDonor {
  email: string;
  name: string;
  phone: string;
  group: BloodGroup;
  lat: number;
  lng: number;
  label: string;
  /** days since last donation; null = never donated; 'unknown' = doesn't know */
  last: number | null | 'unknown';
  verified: boolean;
  note: string;
}

const DONORS: DemoDonor[] = [
  { email: 'donor1@demo.test', name: 'Tashi Donor', phone: '+919000010001', group: 'O+', lat: 28.08, lng: 95.3, label: 'Pasighat town', last: 200, verified: true, note: 'alertable' },
  { email: 'donor2@demo.test', name: 'Nima Donor', phone: '+919000010002', group: 'O+', lat: 28.15, lng: 95.2, label: 'Mebo village', last: null, verified: true, note: 'alertable (never donated)' },
  { email: 'donor3@demo.test', name: 'Rinchen Donor', phone: '+919000010003', group: 'O+', lat: 28.22, lng: 95.05, label: 'Ridge Village', last: 150, verified: true, note: 'alertable, near facility B' },
  { email: 'donor4@demo.test', name: 'Dolma Donor', phone: '+919000010004', group: 'A+', lat: 28.1, lng: 95.28, label: 'Pasighat east', last: 120, verified: true, note: 'alertable (A+)' },
  { email: 'donor5@demo.test', name: 'Karma Donor', phone: '+919000010005', group: 'O+', lat: 28.12, lng: 95.25, label: 'Oyan village', last: 30, verified: true, note: 'resting — donated 30 days ago' },
  { email: 'donor6@demo.test', name: 'Pema Donor', phone: '+919000010006', group: 'O+', lat: 28.09, lng: 95.31, label: 'Pasighat west', last: 'unknown', verified: true, note: 'last donation unknown — manual review list' },
  { email: 'donor7@demo.test', name: 'Sonam Donor', phone: '+919000010007', group: 'B+', lat: 28.3, lng: 95.0, label: 'Upper Valley', last: 300, verified: false, note: 'awaiting admin verification' },
];

for (const d of DONORS) {
  if (await UserModel.exists({ email: d.email })) {
    skipped.push(`donor ${d.email}`);
    continue;
  }
  const user = await UserModel.create({ email: d.email, name: d.name, passwordHash, role: 'donor', phone: d.phone });
  const known = d.last !== 'unknown';
  await DonorProfileModel.create({
    userId: user._id,
    bloodGroup: d.group,
    // donor2 serves the demo coordinator's village and has opted in to relay, so that screen has something to show.
    consent: { contact: true, location: true, relay: d.email === 'donor2@demo.test', at: new Date(), version: DONOR_CONSENT_VERSION },
    availability: 'available',
    availabilityUpdatedAt: new Date(),
    lastDonationKnown: known,
    lastDonationAt: typeof d.last === 'number' ? new Date(now - d.last * DAY) : null,
    anchorLocation: toGeoPoint(coarsen({ lat: d.lat, lng: d.lng })),
    anchorLabel: d.label,
    verificationStatus: d.verified ? 'verified' : 'unverified',
  });
  created.push(`donor ${d.email} ${d.group} — ${d.note}`);
}

// Profiles seeded before the relay consent existed: give donor2 the opt-in once (never overrides a later choice).
{
  const donor2 = await UserModel.findOne({ email: 'donor2@demo.test' }).select('_id');
  if (donor2) {
    const r = await DonorProfileModel.updateOne({ userId: donor2._id, 'consent.relay': { $exists: false } }, { $set: { 'consent.relay': true } });
    if (r.modifiedCount) created.push('donor2 opted in to village relay');
  }
}

// ── one pending request, so a verifier can try the verification step ─────────

const staffA = await UserModel.findOne({ email: 'staff.a@demo.test' });
if (staffA) {
  const patientRefHash = hmacHex(config.PATIENT_REF_SECRET, `${facilityId.a}:DEMO-MRN-0001`);
  if (await BloodRequestModel.exists({ facilityId: facilityId.a, patientRefHash, isActive: true })) {
    skipped.push('sample request DEMO-MRN-0001');
  } else {
    const deadlineAt = new Date(now + 6 * 3_600_000);
    const request = await BloodRequestModel.create({
      publicCode: generatePublicCode(),
      facilityId: facilityId.a,
      createdBy: staffA._id,
      bloodGroup: 'O+',
      unitsRequested: 2,
      urgencySuggested: suggestUrgency(deadlineAt),
      deadlineAt,
      patientRefHash,
      patientLabel: 'Ward 3, bed 12 (fictional)',
    });
    await recordAudit({
      actor: { type: 'user', userId: staffA._id.toString(), role: 'hospital_staff' },
      action: 'request.created',
      resourceType: 'bloodRequest',
      resourceId: request._id,
      facilityId: request.facilityId,
      detail: { publicCode: request.publicCode, seeded: true },
    });
    created.push(`sample request ${request.publicCode} (O+, 2 units, pending verification)`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────

console.log(`\nCreated ${created.length}, left ${skipped.length} existing untouched.`);
for (const line of created) console.log(`  + ${line}`);
console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`);
console.log('  admin@demo.test · staff.a@demo.test · verifier.a@demo.test · verifier.b@demo.test · coord@demo.test · donor1..7@demo.test');
console.log('Everything above is fictional. Do not reuse this password anywhere real.');
await shutdown(0);
