import type { CreateRoadReportInput, RoadReportDecisionInput, RoadReportView } from '@golden-hour/shared';
import { AppError } from '../../lib/errors';
import { fromGeoPoint, toGeoPoint } from '../../lib/geo';
import { withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext, AuthUser } from '../auth/auth.types';
import { UserModel } from '../users/user.model';
import { RoadReportModel, type RoadReportDocument } from './roadReport.model';
import { affectsEta, isStale, roadReportActions } from './roadReport.rules';

/** Stale reports remain visible (greyed) for this long after expiry, for context. */
const SHOW_STALE_FOR_MS = 24 * 60 * 60 * 1000;

async function toViews(reports: RoadReportDocument[], viewer: AuthUser): Promise<RoadReportView[]> {
  const ids = [...new Set(reports.flatMap((r) => [r.reporterId, r.verifiedBy]).filter(Boolean).map(String))];
  const users = await UserModel.find({ _id: { $in: ids } }).select('name').lean();
  const name = new Map(users.map((u) => [u._id.toString(), u.name]));
  const now = Date.now();
  return reports.map((r) => ({
    id: r._id.toString(),
    location: fromGeoPoint(r.location),
    label: r.label,
    condition: r.condition,
    note: r.note ?? null,
    confidence: r.confidence,
    reporter: { name: name.get(r.reporterId.toString()) ?? null, role: r.reporterRole },
    verificationStatus: r.verificationStatus,
    verifiedBy: r.verifiedBy ? (name.get(r.verifiedBy.toString()) ?? null) : null,
    reportedAt: r.reportedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    isStale: isStale(r, now),
    affectsEta: affectsEta(r, now),
    allowedActions: roadReportActions(r, viewer),
  }));
}

/** Current reports plus recently expired ones (shown as stale). Dismissed reports are hidden. */
export async function listRoadReports(viewer: AuthUser): Promise<RoadReportView[]> {
  const reports = await RoadReportModel.find({
    verificationStatus: { $ne: 'dismissed' },
    expiresAt: { $gte: new Date(Date.now() - SHOW_STALE_FOR_MS) },
  })
    .sort({ reportedAt: -1 })
    .limit(300);
  return toViews(reports, viewer);
}

/** Reports that can influence ETA (blocked) or should warn (restricted): current and not dismissed. */
export function loadActiveRoadReports(): Promise<RoadReportDocument[]> {
  return RoadReportModel.find({
    verificationStatus: { $ne: 'dismissed' },
    condition: { $in: ['blocked', 'restricted'] },
    expiresAt: { $gt: new Date() },
  }).limit(500);
}

export async function createRoadReport(input: CreateRoadReportInput, ctx: ActionContext): Promise<RoadReportView> {
  const now = new Date();
  const doc = await withTransaction(async (session) => {
    const [created] = await RoadReportModel.create(
      [
        {
          reporterId: ctx.user.id,
          reporterRole: ctx.user.role,
          location: toGeoPoint(input.location),
          label: input.label,
          condition: input.condition,
          note: input.note || null,
          confidence: input.confidence,
          reportedAt: now,
          expiresAt: new Date(now.getTime() + input.expiresInHours * 3_600_000),
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'road_report.created',
        resourceType: 'roadReport',
        resourceId: created!._id,
        facilityId: ctx.user.facilityId,
        detail: { condition: input.condition, confidence: input.confidence, label: input.label },
        requestId: ctx.requestId,
      },
      session,
    );
    return created!;
  });
  return (await toViews([doc], ctx.user))[0]!;
}

export async function decideRoadReport(id: string, input: RoadReportDecisionInput, ctx: ActionContext): Promise<RoadReportView> {
  const current = await RoadReportModel.findById(id);
  if (!current) throw new AppError('NOT_FOUND', 'Not found.');
  const action = input.decision === 'verified' ? 'verify' : 'dismiss';
  if (!roadReportActions(current, ctx.user).includes(action)) {
    throw new AppError(
      current.reporterId.toString() === ctx.user.id && action === 'verify' ? 'FORBIDDEN' : 'INVALID_TRANSITION',
      current.reporterId.toString() === ctx.user.id && action === 'verify'
        ? 'Another coordinator or an administrator must verify your report.'
        : `This report cannot be ${input.decision} now.`,
    );
  }
  const from = current.verificationStatus;
  const doc = await withTransaction(async (session) => {
    const updated = await RoadReportModel.findOneAndUpdate(
      { _id: id, verificationStatus: from },
      { $set: { verificationStatus: input.decision, verifiedBy: ctx.user.id } },
      { new: true, session },
    );
    if (!updated) throw new AppError('CONFLICT', 'This report was just changed. Refresh and try again.');
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: `road_report.${input.decision}`,
        resourceType: 'roadReport',
        resourceId: updated._id,
        reason: input.reason,
        changes: { verificationStatus: [from, input.decision] },
        requestId: ctx.requestId,
      },
      session,
    );
    return updated;
  });
  return (await toViews([doc], ctx.user))[0]!;
}
