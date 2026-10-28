import { Router } from 'express';
import { adminEscalationsQuerySchema, type AdminEscalationItem } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { BloodRequestModel } from '../requests/request.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { EscalationEventModel } from '../requests/escalationEvent.model';

/**
 * /api/admin/escalations — mounted behind requireRole('admin') (docs/api-contracts.md §Admin).
 * Lists escalated blood requests (ladder steps 1+) for admin review and intervention.
 */
export function adminEscalationRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parse(adminEscalationsQuerySchema, req.query);
    const filter: Record<string, unknown> = { escalationStep: { $gte: 1 } };
    if (query.open !== 'false') {
      filter.requestStatus = 'awaiting_donor';
    }

    const requests = await BloodRequestModel.find(filter)
      .sort({ escalationStep: -1, verifiedAt: 1, createdAt: -1 })
      .limit(100);

    if (requests.length === 0) {
      sendData(res, []);
      return;
    }

    const facilityIds = [...new Set(requests.map((r) => r.facilityId.toString()))];
    const facilities = await HospitalModel.find({ _id: { $in: facilityIds } }).select('name district');
    const facilityMap = new Map(facilities.map((f) => [f._id.toString(), f]));

    const requestIds = requests.map((r) => r._id);
    const allEvents = await EscalationEventModel.find({ requestId: { $in: requestIds } }).sort({ step: 1, at: 1 });
    const eventsByRequest = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
      const key = event.requestId.toString();
      const list = eventsByRequest.get(key) ?? [];
      list.push(event);
      eventsByRequest.set(key, list);
    }

    const now = Date.now();
    const items: AdminEscalationItem[] = requests.map((r) => {
      const facility = facilityMap.get(r.facilityId.toString());
      const events = eventsByRequest.get(r._id.toString()) ?? [];
      const verifiedAtDate = r.verifiedAt ?? r.createdAt;
      const elapsedMinutes = Math.max(0, Math.round((now - verifiedAtDate.getTime()) / 60_000));

      return {
        id: r._id.toString(),
        requestId: r._id.toString(),
        publicCode: r.publicCode,
        facilityId: r.facilityId.toString(),
        facilityName: facility?.name ?? null,
        facilityDistrict: facility?.district ?? null,
        bloodGroup: r.bloodGroup,
        unitsRequested: r.unitsRequested,
        slotsFilled: r.slotsFilled,
        urgency: r.urgencyConfirmed ?? r.urgencySuggested,
        requestStatus: r.requestStatus,
        escalationStep: r.escalationStep,
        verifiedAt: verifiedAtDate.toISOString(),
        deadlineAt: r.deadlineAt.toISOString(),
        elapsedMinutes,
        alertBatches: r.alertBatches,
        events: events.map((e) => ({
          step: e.step,
          outcome: e.outcome,
          at: e.at.toISOString(),
          detail: (e.detail as Record<string, unknown> | null) ?? null,
        })),
      };
    });

    sendData(res, items);
  });

  return router;
}
