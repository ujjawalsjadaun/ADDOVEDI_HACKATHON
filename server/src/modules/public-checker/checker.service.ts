import {
  normalizePublicCode,
  type PublicRequestStatus,
  type SuspiciousReportInput,
  type SuspiciousReportView,
} from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { hmacHex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { withTransaction } from '../../lib/transaction';
import { recordAudit, userActor } from '../audit/audit.service';
import type { ActionContext } from '../auth/auth.types';
import { HospitalModel } from '../hospitals/hospital.model';
import { toPublicStatus } from '../requests/request.dto';
import { BloodRequestModel } from '../requests/request.model';
import { UserModel } from '../users/user.model';
import { SuspiciousReportModel } from './suspiciousReport.model';

const NOT_FOUND: PublicRequestStatus = { status: 'not_found' };

/**
 * Public "Is this real?" lookup. Malformed and unknown codes get the same answer, and the response
 * never contains patient, donor, staff or contact details (docs/security.md §5).
 */
export async function lookupPublicStatus(rawCode: string): Promise<PublicRequestStatus> {
  const code = normalizePublicCode(rawCode);
  if (!code) return NOT_FOUND;
  const request = await BloodRequestModel.findOne({ publicCode: code });
  if (!request) return NOT_FOUND;
  const facility = await HospitalModel.findById(request.facilityId);
  if (!facility) return NOT_FOUND;
  return toPublicStatus(request, facility);
}

/** Records a suspicious-request report. Accepted whether or not the code exists (no enumeration). */
export async function reportSuspicious(input: SuspiciousReportInput, ip: string, config: Config): Promise<void> {
  const code = normalizePublicCode(input.publicCode);
  const request = code ? await BloodRequestModel.findOne({ publicCode: code }).select('_id') : null;
  await SuspiciousReportModel.create({
    publicCode: code ?? input.publicCode.slice(0, 20),
    requestId: request?._id ?? null,
    category: input.category,
    note: input.note || null,
    reporterIpHash: hmacHex(config.SESSION_SECRET, `ip:${ip}`),
  });
}

// ── admin review ─────────────────────────────────────────────────────────────

export async function listSuspiciousReports(query: {
  status?: 'open' | 'reviewed';
  page: number;
  limit: number;
}): Promise<{ items: SuspiciousReportView[]; total: number }> {
  const filter = query.status ? { status: query.status } : {};
  const [reports, total] = await Promise.all([
    SuspiciousReportModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    SuspiciousReportModel.countDocuments(filter),
  ]);
  const requests = await BloodRequestModel.find({ _id: { $in: reports.map((r) => r.requestId).filter(Boolean) } });
  const [facilities, reviewers] = await Promise.all([
    HospitalModel.find({ _id: { $in: requests.map((r) => r.facilityId) } }).select('name'),
    UserModel.find({ _id: { $in: reports.map((r) => r.reviewedBy).filter(Boolean) } }).select('name'),
  ]);
  const reqById = new Map(requests.map((r) => [r._id.toString(), r]));
  const facName = new Map(facilities.map((f) => [f._id.toString(), f.name]));
  const reviewerName = new Map(reviewers.map((u) => [u._id.toString(), u.name]));

  // Repeat reporting from one source is a signal (or abuse); count by keyed IP hash, never the IP.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sameReporter = new Map(
    (
      await SuspiciousReportModel.aggregate<{ _id: string; n: number }>([
        { $match: { reporterIpHash: { $in: [...new Set(reports.map((r) => r.reporterIpHash))] }, createdAt: { $gte: since } } },
        { $group: { _id: '$reporterIpHash', n: { $sum: 1 } } },
      ])
    ).map((x) => [x._id, x.n]),
  );

  return {
    items: reports.map((r) => {
      const request = r.requestId ? reqById.get(r.requestId.toString()) : undefined;
      return {
        id: r._id.toString(),
        publicCode: r.publicCode,
        category: r.category,
        note: r.note ?? null,
        status: r.status,
        createdAt: (r.get('createdAt') as Date).toISOString(),
        sameReporterCount24h: sameReporter.get(r.reporterIpHash) ?? 1,
        request: request
          ? {
              id: request._id.toString(),
              facilityName: facName.get(request.facilityId.toString()) ?? '—',
              bloodGroup: request.bloodGroup,
              requestStatus: request.requestStatus,
              verificationStatus: request.verificationStatus,
            }
          : null,
        reviewedBy: r.reviewedBy ? (reviewerName.get(r.reviewedBy.toString()) ?? null) : null,
      };
    }),
    total,
  };
}

/** Marks a report reviewed. Any follow-up (cancel a request, suspend an account) is a separate audited action. */
export async function reviewSuspiciousReport(id: string, reason: string, ctx: ActionContext): Promise<void> {
  await withTransaction(async (session) => {
    const report = await SuspiciousReportModel.findOneAndUpdate(
      { _id: id, status: 'open' },
      { $set: { status: 'reviewed', reviewedBy: ctx.user.id } },
      { new: true, session },
    );
    if (!report) {
      const exists = await SuspiciousReportModel.exists({ _id: id }).session(session);
      throw exists ? new AppError('INVALID_TRANSITION', 'This report was already reviewed.') : new AppError('NOT_FOUND', 'Not found.');
    }
    await recordAudit(
      {
        actor: userActor(ctx.user),
        action: 'report.reviewed',
        resourceType: 'bloodRequest',
        resourceId: report.requestId ?? undefined,
        reason,
        detail: { reportId: report._id.toString(), publicCode: report.publicCode, category: report.category },
        requestId: ctx.requestId,
      },
      session,
    );
  });
}
