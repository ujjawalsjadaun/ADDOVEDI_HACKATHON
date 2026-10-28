import { Router } from 'express';
import { auditQuerySchema, type AuditEntryView } from '@golden-hour/shared';
import { sendData } from '../../lib/http';
import { parse } from '../../lib/validation';
import { HospitalModel } from '../hospitals/hospital.model';
import { UserModel } from '../users/user.model';
import { AuditLog } from './audit.model';

/** /api/admin/audit — read-only, paginated, newest first. Mounted behind requireRole('admin'). */
export function adminAuditRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(auditQuerySchema, req.query);
    const filter: Record<string, unknown> = {};
    // Prefix match on the dotted action name, e.g. "request." or "auth.login_failed".
    if (q.action) filter.action = { $regex: `^${q.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
    if (q.resourceType) filter.resourceType = q.resourceType;
    if (q.resourceId) filter.resourceId = q.resourceId;
    if (q.facilityId) filter.facilityId = q.facilityId;
    if (q.result) filter.result = q.result;
    if (q.from || q.to) filter.at = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };

    const [rows, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    const [users, facilities] = await Promise.all([
      UserModel.find({ _id: { $in: rows.map((r) => r.actor?.userId).filter(Boolean) } }).select('name').lean(),
      HospitalModel.find({ _id: { $in: rows.map((r) => r.facilityId).filter(Boolean) } }).select('name').lean(),
    ]);
    const userName = new Map(users.map((u) => [u._id.toString(), u.name]));
    const facilityName = new Map(facilities.map((f) => [f._id.toString(), f.name]));

    const items: AuditEntryView[] = rows.map((r) => ({
      id: r._id.toString(),
      at: r.at.toISOString(),
      action: r.action,
      result: r.result,
      actor: {
        type: r.actor?.type ?? 'system',
        name: r.actor?.type === 'system' ? 'System' : r.actor?.userId ? (userName.get(r.actor.userId.toString()) ?? null) : null,
        role: r.actor?.role ?? null,
      },
      resourceType: r.resourceType,
      resourceId: r.resourceId ? r.resourceId.toString() : null,
      facilityName: r.facilityId ? (facilityName.get(r.facilityId.toString()) ?? null) : null,
      reason: r.reason ?? null,
      changes: (r.changes as AuditEntryView['changes']) ?? null,
      detail: (r.detail as AuditEntryView['detail']) ?? null,
    }));
    sendData(res, items, { meta: { page: q.page, limit: q.limit, total } });
  });

  return router;
}
