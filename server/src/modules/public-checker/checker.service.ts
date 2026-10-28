import { normalizePublicCode, type PublicRequestStatus, type SuspiciousReportInput } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { hmacHex } from '../../lib/crypto';
import { HospitalModel } from '../hospitals/hospital.model';
import { toPublicStatus } from '../requests/request.dto';
import { BloodRequestModel } from '../requests/request.model';
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
