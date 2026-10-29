import type { MissedCallInput, SmsReplyInput, SmsReplyResult } from '@golden-hour/shared';
import { AppError } from '../../lib/errors';
import { maskPhone } from '../../lib/mask';
import { recordAudit } from '../audit/audit.service';
import { toAuthUser } from '../auth/auth.dto';
import { DonorProfileModel } from '../donors/donor.model';
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
export async function handleSmsReply(input: SmsReplyInput, requestId?: string): Promise<SmsReplyResult> {
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
