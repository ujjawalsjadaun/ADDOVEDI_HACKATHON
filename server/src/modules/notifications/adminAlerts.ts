import { withTransaction } from '../../lib/transaction';
import { HospitalModel } from '../hospitals/hospital.model';
import type { BloodRequestDocument } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { enqueueNotification } from './outbox.service';

/**
 * Escalation steps 2 and 3 text every active administrator who has a phone number, so "admin alerted" does not
 * depend on someone watching the screen. One message per admin per step (idempotent on the event id).
 */
export async function queueAdminEscalationTexts(request: BloodRequestDocument, step: number, elapsedMinutes: number): Promise<number> {
  const [admins, facility] = await Promise.all([
    UserModel.find({ role: 'admin', status: 'active', phone: { $exists: true, $nin: [null, ''] } }).select('_id'),
    HospitalModel.findById(request.facilityId).select('name'),
  ]);
  if (admins.length === 0) return 0;
  await withTransaction(async (session) => {
    for (const admin of admins) {
      await enqueueNotification(session, {
        eventId: `escalation:${request._id.toString()}:${step}:${admin._id.toString()}`,
        type: 'admin_escalation',
        recipientUserId: admin._id,
        requestId: request._id,
        vars: { publicCode: request.publicCode, facilityName: facility?.name ?? 'a facility', bloodGroup: request.bloodGroup, step, elapsedMinutes },
      });
    }
  });
  return admins.length;
}
