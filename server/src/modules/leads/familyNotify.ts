import type { ClientSession, Types } from 'mongoose';
import { HospitalModel } from '../hospitals/hospital.model';
import { enqueueNotification } from '../notifications/outbox.service';
import type { FamilyLeadUpdateVars } from '../notifications/templates';
import { BloodRequestModel } from '../requests/request.model';
import { FamilyLeadModel } from './familyLead.model';

/**
 * If a family asked for this request, queues them a status text inside the caller's transaction.
 * `key` makes it idempotent per event (e.g. `accepted:<assignmentId>`). Messages go only to numbers the
 * family confirmed (checked at send time) and never contain patient or donor details.
 */
export async function notifyFamilyOfRequest(
  session: ClientSession,
  requestId: Types.ObjectId,
  key: string,
  extra: Pick<FamilyLeadUpdateVars, 'event'> & Partial<FamilyLeadUpdateVars>,
): Promise<void> {
  const lead = await FamilyLeadModel.findOne({ linkedRequestId: requestId }).session(session).select('_id');
  if (!lead) return;
  const request = await BloodRequestModel.findById(requestId).session(session).select('publicCode facilityId');
  if (!request) return;
  const facility = await HospitalModel.findById(request.facilityId).session(session).select('name');
  await enqueueNotification(session, {
    eventId: `lead:${lead._id.toString()}:${key}`,
    type: 'family_lead_update',
    recipientLeadId: lead._id,
    requestId,
    vars: { facilityName: facility?.name ?? 'The hospital', publicCode: request.publicCode, ...extra },
  });
}
