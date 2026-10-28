import type { AdminOverview, CoordinatorRequestView, HospitalDashboard } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { AppError } from '../../lib/errors';
import { fromGeoPoint } from '../../lib/geo';
import { toEtaView } from '../alerts/alert.dto';
import { RequestAlertModel } from '../alerts/alert.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { AuditLog } from '../audit/audit.model';
import { toFacilitySummary } from '../auth/auth.dto';
import type { AuthUser } from '../auth/auth.types';
import { DonorProfileModel } from '../donors/donor.model';
import { HospitalModel } from '../hospitals/hospital.model';
import { SuspiciousReportModel } from '../public-checker/suspiciousReport.model';
import { toRequestSummary } from '../requests/request.dto';
import { BloodRequestModel, type BloodRequestDocument } from '../requests/request.model';
import { UserModel } from '../users/user.model';

// Read models only — dashboards never change state and never invent statuses.

const HOUR_MS = 3_600_000;
const ACTIVE_ASSIGNMENT = ['accepted', 'en_route', 'arrived'];

function startOfTodayIst(now: Date): Date {
  // Asia/Kolkata is UTC+05:30 with no daylight saving.
  const offset = 330 * 60_000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

/** Why a hospital user should look at this request now (empty = nothing urgent). */
function actionReasons(r: BloodRequestDocument, now: number): string[] {
  const reasons: string[] = [];
  if (r.requestStatus === 'open' && r.duplicateReview.status === 'pending') reasons.push('Possible duplicate — review');
  else if (r.requestStatus === 'open') reasons.push('Awaiting verification');
  if (r.requestStatus === 'awaiting_donor' && r.slotsFilled === 0) reasons.push('No donor has accepted yet');
  const left = r.deadlineAt.getTime() - now;
  if (left <= 0) reasons.push('Deadline passed — fulfil or cancel');
  else if (left <= 2 * HOUR_MS) reasons.push('Deadline within 2 hours');
  return reasons;
}

export async function getHospitalDashboard(user: AuthUser): Promise<HospitalDashboard> {
  if (user.role !== 'hospital_staff' || !user.facilityId) throw new AppError('FORBIDDEN', 'Only hospital staff have a facility dashboard.');
  const facility = await HospitalModel.findById(user.facilityId);
  if (!facility) throw new AppError('NOT_FOUND', 'Not found.');
  const now = new Date();
  const nowMs = now.getTime();

  const [active, fulfilledToday, assignments] = await Promise.all([
    BloodRequestModel.find({ facilityId: facility._id, isActive: true }).sort({ deadlineAt: 1 }).limit(200),
    BloodRequestModel.countDocuments({ facilityId: facility._id, 'closure.reason': 'fulfilled', 'closure.at': { $gte: startOfTodayIst(now) } }),
    AssignmentModel.find({ facilityId: facility._id, status: { $in: ACTIVE_ASSIGNMENT } }).sort({ acceptedAt: 1 }).limit(50),
  ]);

  const requestById = new Map(active.map((r) => [r._id.toString(), r]));
  const donors = await UserModel.find({ _id: { $in: assignments.map((a) => a.donorUserId) } }).select('name');
  const donorName = new Map(donors.map((d) => [d._id.toString(), d.name]));

  const needsAction = active
    .map((r) => ({ ...toRequestSummary(r, facility.name), reasons: actionReasons(r, nowMs) }))
    .filter((r) => r.reasons.length > 0)
    .slice(0, 15);

  return {
    generatedAt: now.toISOString(),
    facility: toFacilitySummary(facility),
    counts: {
      active: active.length,
      awaitingVerification: active.filter((r) => r.requestStatus === 'open').length,
      duplicateReviews: active.filter((r) => r.requestStatus === 'open' && r.duplicateReview.status === 'pending').length,
      awaitingDonors: active.filter((r) => r.requestStatus === 'awaiting_donor').length,
      donorsOnTheWay: assignments.length,
      dueWithin2h: active.filter((r) => r.deadlineAt.getTime() - nowMs <= 2 * HOUR_MS).length,
      fulfilledToday,
    },
    needsAction,
    donorsInProgress: assignments.flatMap((a) => {
      const r = requestById.get(a.requestId.toString());
      if (!r) return [];
      return [
        {
          assignmentId: a._id.toString(),
          requestId: r._id.toString(),
          publicCode: r.publicCode,
          bloodGroup: r.bloodGroup,
          donorName: donorName.get(a.donorUserId.toString()) ?? 'Donor',
          status: a.status,
          eta: toEtaView(a.eta),
          acceptedAt: a.acceptedAt.toISOString(),
        },
      ];
    }),
  };
}

export async function getAdminOverview(config: Config): Promise<AdminOverview> {
  const now = new Date();
  const overdueBefore = new Date(now.getTime() - config.VERIFICATION_DEADLINE_MIN * 60_000);

  const [pendingFacilities, unverifiedDonors, donorsUnderReview, activeRequests, openReports, failedLogins, overdue, awaiting] = await Promise.all([
    HospitalModel.countDocuments({ verificationStatus: 'pending' }),
    DonorProfileModel.countDocuments({ verificationStatus: 'unverified' }),
    DonorProfileModel.countDocuments({ reviewStatus: 'under_review' }),
    BloodRequestModel.countDocuments({ isActive: true }),
    SuspiciousReportModel.countDocuments({ status: 'open' }),
    AuditLog.countDocuments({ action: 'auth.login_failed', at: { $gte: new Date(now.getTime() - 24 * HOUR_MS) } }),
    BloodRequestModel.find({ requestStatus: 'open', verificationStatus: 'pending', createdAt: { $lte: overdueBefore } }).sort({ createdAt: 1 }).limit(20),
    BloodRequestModel.find({ requestStatus: 'awaiting_donor', slotsFilled: 0 }).sort({ deadlineAt: 1 }).limit(100),
  ]);

  // "Without responders": nobody is currently considering it (no pending alert) and nobody accepted.
  const live = new Set(
    (await RequestAlertModel.find({ requestId: { $in: awaiting.map((r) => r._id) }, response: 'pending', expiresAt: { $gt: now } }).distinct('requestId')).map(String),
  );
  const stuck = awaiting.filter((r) => !live.has(r._id.toString())).slice(0, 20);
  const alertCounts = new Map(
    (
      await RequestAlertModel.aggregate<{ _id: unknown; n: number }>([
        { $match: { requestId: { $in: stuck.map((r) => r._id) } } },
        { $group: { _id: '$requestId', n: { $sum: 1 } } },
      ])
    ).map((x) => [String(x._id), x.n]),
  );

  const facilityIds = [...new Set([...overdue, ...stuck].map((r) => r.facilityId.toString()))];
  const facilities = await HospitalModel.find({ _id: { $in: facilityIds } }).select('name');
  const facilityName = new Map(facilities.map((f) => [f._id.toString(), f.name]));

  return {
    generatedAt: now.toISOString(),
    counts: {
      pendingFacilities,
      unverifiedDonors,
      donorsUnderReview,
      overdueVerifications: overdue.length,
      activeRequests,
      requestsWithoutResponders: stuck.length,
      openSuspiciousReports: openReports,
      failedLogins24h: failedLogins,
    },
    overdueVerifications: overdue.map((r) => ({
      id: r._id.toString(),
      publicCode: r.publicCode,
      facilityName: facilityName.get(r.facilityId.toString()) ?? '—',
      bloodGroup: r.bloodGroup,
      createdAt: (r.get('createdAt') as Date).toISOString(),
      deadlineAt: r.deadlineAt.toISOString(),
    })),
    requestsWithoutResponders: stuck.map((r) => ({
      id: r._id.toString(),
      publicCode: r.publicCode,
      facilityName: facilityName.get(r.facilityId.toString()) ?? '—',
      bloodGroup: r.bloodGroup,
      deadlineAt: r.deadlineAt.toISOString(),
      alertsSent: alertCounts.get(r._id.toString()) ?? 0,
    })),
    verificationDeadlineMinutes: config.VERIFICATION_DEADLINE_MIN,
  };
}

/** Active, verified requests across facilities — logistics fields only (docs/security.md §1). */
export async function listCoordinatorRequests(): Promise<CoordinatorRequestView[]> {
  const requests = await BloodRequestModel.find({ isActive: true, verificationStatus: 'verified' }).sort({ deadlineAt: 1 }).limit(100);
  const [facilities, onTheWay] = await Promise.all([
    HospitalModel.find({ _id: { $in: requests.map((r) => r.facilityId) } }),
    AssignmentModel.aggregate<{ _id: unknown; n: number }>([
      { $match: { requestId: { $in: requests.map((r) => r._id) }, status: { $in: ['en_route', 'accepted'] } } },
      { $group: { _id: '$requestId', n: { $sum: 1 } } },
    ]),
  ]);
  const byId = new Map(facilities.map((f) => [f._id.toString(), f]));
  const moving = new Map(onTheWay.map((x) => [String(x._id), x.n]));
  return requests.flatMap((r) => {
    const f = byId.get(r.facilityId.toString());
    if (!f) return [];
    return [
      {
        id: r._id.toString(),
        publicCode: r.publicCode,
        facility: { id: f._id.toString(), name: f.name, district: f.district, address: f.address, location: fromGeoPoint(f.location) },
        bloodGroup: r.bloodGroup,
        urgency: r.urgencyConfirmed ?? r.urgencySuggested,
        unitsRequested: r.unitsRequested,
        slotsFilled: r.slotsFilled,
        donorsOnTheWay: moving.get(r._id.toString()) ?? 0,
        requestStatus: r.requestStatus,
        deadlineAt: r.deadlineAt.toISOString(),
        verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      },
    ];
  });
}
