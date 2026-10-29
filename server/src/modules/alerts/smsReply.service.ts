import { BLOOD_GROUPS, hospitalSmsCode, type MissedCallInput, type SmsReplyInput, type SmsReplyResult } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { maskPhone } from '../../lib/mask';
import { recordAudit } from '../audit/audit.service';
import { toAuthUser } from '../auth/auth.dto';
import { DonorProfileModel } from '../donors/donor.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { FamilyLeadModel } from '../leads/familyLead.model';
import { submitFamilyLead, verifyFamilyPhone } from '../leads/familyLead.service';
import { publish, rooms } from '../../realtime/emitter';
import { UserModel } from '../users/user.model';
import { acceptAlert } from '../assignments/assignment.service';
import { RequestAlertModel } from './alert.model';
import { declineAlert } from './alert.service';

// "YES", "yes k7p2", "N", "no K7P2". The code is only needed when the donor has several open alerts.
const REPLY = /^\s*(y|yes|n|no)\b[\s.:,-]*([a-z0-9]{4})?\s*$/i;

const reply = (outcome: SmsReplyResult['outcome'], replyText: string): SmsReplyResult => ({ outcome, replyText });

/**
 * Applies an SMS reply as the donor's own answer — same rules as the app (acceptAlert / declineAlert),
 * so a double SMS, a full request or a busy donor behave exactly as they do on screen.
 * The sender is identified by the registered phone number only; replies reveal nothing else.
 */
export async function handleSmsReply(input: SmsReplyInput, config: Config, requestId?: string): Promise<SmsReplyResult> {
  // A family asking for blood ("BLOOD O- Siang-HDH P1234") or confirming its number (the 6-digit code).
  if (/^\s*blood\b/i.test(input.body)) return handleFamilyRequestSms(input, config, requestId);
  if (/^\s*\d{6}\s*$/.test(input.body)) return handleFamilyCodeSms(input, config);

  const donor = await UserModel.findOne({ role: 'donor', phone: input.from, status: 'active' });
  if (!donor) return reply('unknown_sender', 'Golden Hour: this number is not registered as a donor, so the reply was ignored.');

  const match = REPLY.exec(input.body);
  if (!match) return reply('unrecognised', 'Golden Hour: please reply YES or NO (add the 4-character code if you have several requests).');
  const yes = match[1]!.toLowerCase().startsWith('y');
  const code = match[2]?.toUpperCase();

  const open = await RequestAlertModel.find({
    donorUserId: donor._id,
    response: 'pending',
    expiresAt: { $gt: new Date() },
    ...(code ? { shortCode: code } : {}),
  }).sort({ createdAt: -1 });

  if (open.length === 0) return reply('no_open_alert', 'Golden Hour: there is no open request for you to answer. Thank you.');
  if (open.length > 1) return reply('needs_code', 'Golden Hour: you have several open requests. Reply YES or NO followed by the 4-character code in the message.');

  const alert = open[0]!;
  const user = toAuthUser(donor);
  const actor = { type: 'user' as const, userId: user.id, role: user.role };
  try {
    if (yes) await acceptAlert(alert._id.toString(), user, requestId);
    else await declineAlert(alert._id.toString(), user);
  } catch (err) {
    if (err instanceof AppError) return reply('rejected', `Golden Hour: ${err.message}`);
    throw err;
  }
  await recordAudit({
    actor,
    action: 'donor.sms_reply',
    resourceType: 'bloodRequest',
    resourceId: alert.requestId,
    facilityId: alert.facilityId,
    detail: { alertId: alert._id.toString(), answer: yes ? 'yes' : 'no', from: maskPhone(input.from) },
    requestId,
  });
  return yes
    ? reply('accepted', 'Golden Hour: thank you — you are confirmed. Open the app for the hospital location and directions.')
    : reply('declined', 'Golden Hour: noted — thank you for answering.');
}


/**
 * A missed call from a registered donor number marks them available and refreshes the availability
 * timestamp (availability older than 30 days stops matching). It never accepts an alert by itself.
 */
export async function handleMissedCall(input: MissedCallInput, requestId?: string): Promise<SmsReplyResult> {
  const donor = await UserModel.findOne({ role: 'donor', phone: input.from, status: 'active' });
  if (!donor) return reply('unknown_sender', 'Golden Hour: this number is not registered as a donor.');
  const profile = await DonorProfileModel.findOneAndUpdate({ userId: donor._id }, { $set: { availability: 'available', availabilityUpdatedAt: new Date() } });
  if (!profile) return reply('unknown_sender', 'Golden Hour: this number is not registered as a donor.');
  await recordAudit({
    actor: { type: 'user', userId: donor._id.toString(), role: 'donor' },
    action: 'donor.missed_call_available',
    resourceType: 'user',
    resourceId: donor._id,
    detail: { from: maskPhone(input.from), was: profile.availability },
    requestId,
  });
  return reply('availability_refreshed', 'Golden Hour: thank you — you are marked available today. We will only text you when your blood group is needed.');
}

const FAMILY_REQUEST = /^\s*blood\s+(ab|a|b|o)\s*([+-])\s+(\S+)(?:\s+(.+))?$/i;

/**
 * A family opens a request by SMS: `BLOOD <group> <hospital code> [patient id]`. This only creates the same
 * pending lead as the web form; the hospital still confirms it on its own registered number, and no donor
 * is alerted before that. The hospital code is shown on the public pages (derived from the facility name).
 */
async function handleFamilyRequestSms(input: SmsReplyInput, config: Config, requestId?: string): Promise<SmsReplyResult> {
  const m = FAMILY_REQUEST.exec(input.body);
  if (!m) return reply('unrecognised', 'Golden Hour: to ask for blood send BLOOD, the blood group, the hospital code and the patient ID. Example: BLOOD O- Siang-HDH P1234');
  const bloodGroup = `${m[1]!.toUpperCase()}${m[2]}`;
  if (!(BLOOD_GROUPS as readonly string[]).includes(bloodGroup)) return reply('unrecognised', 'Golden Hour: that blood group was not understood. Example: BLOOD O- Siang-HDH P1234');
  const token = m[3]!.toLowerCase();
  const hospitals = (await HospitalModel.find({ verificationStatus: 'verified' }).select('name')).filter((h) => hospitalSmsCode(h.name).toLowerCase() === token);
  if (hospitals.length !== 1) {
    return reply('rejected', 'Golden Hour: the hospital code was not recognised. Check the code on the Golden Hour page, or call the hospital directly.');
  }
  const hospital = hospitals[0]!;
  try {
    const receipt = await submitFamilyLead(
      {
        hospitalId: hospital._id.toString(),
        contactName: 'Family (by SMS)',
        contactPhone: input.from,
        bloodGroup: bloodGroup as (typeof BLOOD_GROUPS)[number],
        note: m[4] ? `Patient ID given by SMS: ${m[4].slice(0, 40)}` : 'Requested by SMS',
      },
      requestId ?? 'sms',
      config,
    );
    const lead = await FamilyLeadModel.findOne({ reference: receipt.reference }).select('_id');
    if (lead) publish('lead', [rooms.facility(hospital._id)], lead._id);
    return reply('family_request_received', `Golden Hour: your request was sent to ${receipt.facilityName}. Reply with the 6-digit code we are texting you to confirm your number. Reference ${receipt.reference}.`);
  } catch (err) {
    if (err instanceof AppError) return reply('rejected', `Golden Hour: ${err.message}`);
    throw err;
  }
}

/** The family replies with the code texted to them; same check (and limits) as typing it on the web page. */
async function handleFamilyCodeSms(input: SmsReplyInput, config: Config): Promise<SmsReplyResult> {
  const lead = await FamilyLeadModel.findOne({ contactPhone: input.from, phoneVerified: false, status: 'pending' }).sort({ createdAt: -1 });
  if (!lead) return reply('unrecognised', 'Golden Hour: there is no request waiting for a code from this number.');
  try {
    await verifyFamilyPhone({ reference: lead.reference, code: input.body.trim() }, config);
  } catch (err) {
    if (err instanceof AppError) return reply('rejected', 'Golden Hour: that code is not correct, or it is no longer valid.');
    throw err;
  }
  return reply('family_phone_confirmed', 'Golden Hour: number confirmed. You will get a text at each step once the hospital acts on your request.');
}
