// npm run import:directory -w server -- <file.csv> [--state "Arunachal Pradesh"] [--default-district "<name>"] [--dry-run]
//
// Imports a public hospital / health-centre directory (e.g. the data.gov.in "Hospital Directory" or
// "All India Health Centres Directory" CSV listed in the pitch) as PENDING facilities. Nothing is verified
// automatically: an administrator still verifies each facility, with a reason, before it can raise requests.
//
// Safe to re-run (a facility already present with the same name and district is skipped). Rows without usable
// coordinates are skipped: matching and travel times need a location. Rows without a usable phone number get a
// clearly fake placeholder and are listed, so the admin can correct the number before verifying.

import { readFileSync } from 'node:fs';
import { hospitalSmsCode, type FacilityType } from '@golden-hour/shared';
import { toGeoPoint } from '../lib/geo';
import { ensureIndexes } from '../lib/indexes';
import { recordAudit, SYSTEM_ACTOR } from '../modules/audit/audit.service';
import { HospitalModel } from '../modules/hospitals/hospital.model';
import { bootstrap, shutdown } from './cli';

const PLACEHOLDER_PHONE = '+910000000000';

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, CRLF or LF, optional BOM. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a byte-order mark
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES: Record<string, string[]> = {
  name: ['hospitalname', 'facilityname', 'healthcentrename', 'nameofhospital', 'name'],
  state: ['state', 'statename'],
  district: ['district', 'districtname'],
  address: ['address', 'location', 'locationaddress', 'fulladdress'],
  lat: ['latitude', 'lat'],
  lng: ['longitude', 'long', 'lng', 'lon'],
  phone: ['mobilenumber', 'telephone', 'phone', 'contactnumber', 'landline', 'mobile'],
  type: ['hospitaltype', 'facilitytype', 'hospitalcategory', 'category', 'type'],
};

function normalisePhone(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : null;
}

function facilityType(raw: string | undefined): FacilityType {
  const t = (raw ?? '').toLowerCase();
  if (t.includes('blood')) return t.includes('hospital') ? 'hospital_with_blood_bank' : 'blood_bank';
  return 'hospital';
}

const args = process.argv.slice(2);
const stateAt = args.indexOf('--state');
const file = args.find((a, i) => !a.startsWith('--') && (stateAt < 0 || i !== stateAt + 1) && (districtAt < 0 || i !== districtAt + 1));
const stateFilter = (stateAt >= 0 ? (args[stateAt + 1] ?? '') : 'Arunachal Pradesh').toLowerCase();
const dryRun = args.includes('--dry-run');
const districtAt = args.indexOf('--default-district');
const defaultDistrict = districtAt >= 0 ? (args[districtAt + 1] ?? '').trim() : '';

if (!file) {
  console.error('Usage: npm run import:directory -w server -- <file.csv> [--state "Arunachal Pradesh"] [--dry-run]');
  process.exit(1);
}

const rows = parseCsv(readFileSync(file, 'utf8'));
const header = rows.shift()?.map(key) ?? [];
const col = (field: keyof typeof ALIASES) => header.findIndex((h) => ALIASES[field]!.includes(h));
const idx = Object.fromEntries((Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map((f) => [f, col(f)])) as Record<keyof typeof ALIASES, number>;
const missing = (['name', 'district', 'lat', 'lng'] as const).filter((f) => idx[f] < 0);
if (missing.length) {
  console.error(`The CSV needs columns for: ${missing.join(', ')}. Found headers: ${header.join(', ')}`);
  process.exit(1);
}

const config = await bootstrap();
await ensureIndexes();

const cell = (r: string[], f: keyof typeof ALIASES) => (idx[f] >= 0 ? (r[idx[f]] ?? '').trim() : '');
let imported = 0;
let existing = 0;
const skippedNoLocation: string[] = [];
const skippedNoDistrict: string[] = [];
const needsPhone: string[] = [];
let otherState = 0;

for (const r of rows) {
  if (idx.state >= 0 && cell(r, 'state').toLowerCase() !== stateFilter) {
    otherState++;
    continue;
  }
  const name = cell(r, 'name');
  const district = cell(r, 'district') || defaultDistrict;
  const lat = Number(cell(r, 'lat'));
  const lng = Number(cell(r, 'lng'));
  if (!name) continue;
  if (!district) {
    skippedNoDistrict.push(name);
    continue;
  }
  // India's bounding box: catches swapped or garbage coordinates in public data.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    skippedNoLocation.push(name);
    continue;
  }
  if (await HospitalModel.exists({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), district })) {
    existing++;
    continue;
  }
  const phone = normalisePhone(cell(r, 'phone'));
  if (!phone) needsPhone.push(name);
  if (!dryRun) {
    const doc = await HospitalModel.create({
      name,
      facilityType: facilityType(cell(r, 'type')),
      district,
      address: cell(r, 'address') || `${district}, ${cell(r, 'state') || 'India'}`,
      location: toGeoPoint({ lat, lng }),
      registeredPhone: phone ?? PLACEHOLDER_PHONE,
      verificationStatus: 'pending',
    });
    await recordAudit({
      actor: SYSTEM_ACTOR,
      action: 'hospital.imported',
      resourceType: 'hospital',
      resourceId: doc._id,
      facilityId: doc._id,
      detail: { source: 'directory-csv', smsCode: hospitalSmsCode(name) },
    });
  }
  imported++;
}

console.log(`\n${dryRun ? '[dry run] would import' : 'Imported'} ${imported} facilities as PENDING; ${existing} already present; ${otherState} rows in other states ignored.`);
if (skippedNoDistrict.length) {
  console.log(`Skipped ${skippedNoDistrict.length} with no district (re-run with --default-district "<name>" to keep them): ${skippedNoDistrict.slice(0, 8).join('; ')}${skippedNoDistrict.length > 8 ? '…' : ''}`);
}
if (skippedNoLocation.length) console.log(`Skipped ${skippedNoLocation.length} without usable coordinates, e.g. ${skippedNoLocation.slice(0, 5).join('; ')}`);
if (needsPhone.length) {
  console.log(`${needsPhone.length} have no usable phone and carry the placeholder ${PLACEHOLDER_PHONE}. Correct the number before verifying: ${needsPhone.slice(0, 8).join('; ')}${needsPhone.length > 8 ? '…' : ''}`);
}
console.log('Facilities stay unverified until an administrator verifies each one (Admin → Facilities).');
void config;
await shutdown(0);
