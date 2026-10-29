import type { NotificationType } from '@golden-hour/shared';

// SMS templates. Short, plain, verifiable: every message carries the public code and a checker link.
// They never include patient identity, ward, notes or any donor's details.

export interface DonorAlertVars {
  publicCode: string;
  facilityName: string;
  district: string;
  bloodGroup: string;
  deadlineText: string;
  checkUrl: string;
  appUrl: string;
  /** Present from the SMS-reply feature on; older queued messages render without the reply hint. */
  shortCode?: string;
}

export interface RequestClosedVars {
  publicCode: string;
  facilityName: string;
  outcome: 'fulfilled' | 'cancelled' | 'expired';
}

export interface FamilyPhoneCodeVars {
  code: string;
  facilityName: string;
}

export interface FamilyLeadUpdateVars {
  event: 'confirmed' | 'rejected' | 'closed' | 'alerted' | 'donor_accepted' | 'donor_en_route' | 'donor_arrived';
  facilityName: string;
  publicCode?: string;
  checkUrl?: string;
  outcome?: 'fulfilled' | 'cancelled' | 'expired';
  /** alerted: donors alerted in this batch. donor_accepted: units covered so far / needed. */
  count?: number;
  needed?: number;
  /** Nearest point an ambulance can reach, if the facility has marked one. */
  ambulancePointText?: string;
}

/** Sent to the facility's REGISTERED number (not the family's). Carries no family contact or patient detail. */
export interface HospitalFamilyLeadVars {
  facilityName: string;
  reference: string;
  bloodGroup?: string;
}

export interface AdminEscalationVars {
  publicCode: string;
  facilityName: string;
  bloodGroup: string;
  step: number;
  elapsedMinutes: number;
}

export type TemplateVars = DonorAlertVars | RequestClosedVars | FamilyPhoneCodeVars | FamilyLeadUpdateVars | HospitalFamilyLeadVars | AdminEscalationVars;

export function renderSms(type: NotificationType, vars: TemplateVars): string {
  switch (type) {
    case 'donor_alert': {
      const v = vars as DonorAlertVars;
      return (
        `Golden Hour: ${v.facilityName}, ${v.district} needs ${v.bloodGroup} blood by ${v.deadlineText}. ` +
        `Can you come? ${v.shortCode ? `Reply YES ${v.shortCode} to come or NO ${v.shortCode} if you cannot, or answer` : 'Answer'} in the app: ${v.appUrl}/donor . Check it is genuine: ${v.checkUrl} (code ${v.publicCode}).`
      );
    }
    case 'request_closed_for_donor': {
      const v = vars as RequestClosedVars;
      const why = v.outcome === 'fulfilled' ? 'the need has been met' : v.outcome === 'expired' ? 'it has expired' : 'it was cancelled';
      return `Golden Hour: request ${v.publicCode} at ${v.facilityName} is closed — ${why}. You no longer need to come. Thank you.`;
    }
    case 'family_phone_code': {
      const v = vars as FamilyPhoneCodeVars;
      return `Golden Hour: your confirmation code is ${v.code}. Enter it on the page to confirm this number for your request to ${v.facilityName}. Never share it with anyone else.`;
    }
    case 'hospital_family_lead': {
      const v = vars as HospitalFamilyLeadVars;
      return `Golden Hour: a family has asked ${v.facilityName} for ${v.bloodGroup ? `${v.bloodGroup} ` : ''}blood (reference ${v.reference}). Open the hospital console to confirm or reject it. No donor is alerted until staff confirm. This text goes only to your registered number.`;
    }
    case 'admin_escalation': {
      const v = vars as AdminEscalationVars;
      return v.step >= 3
        ? `Golden Hour: ${v.bloodGroup} request ${v.publicCode} at ${v.facilityName} is still open after ${v.elapsedMinutes} min with no donor. Please call nearby hospitals and blood banks.`
        : `Golden Hour: ${v.bloodGroup} request ${v.publicCode} at ${v.facilityName} has had no donor for ${v.elapsedMinutes} min. The facility was told to check its own blood bank.`;
    }
    case 'family_lead_update': {
      const v = vars as FamilyLeadUpdateVars;
      if (v.event === 'confirmed') {
        const ambulance = v.ambulancePointText ? ` Nearest ambulance point: ${v.ambulancePointText}.` : '';
        return `Golden Hour: ${v.facilityName} has confirmed your request and raised an official request, code ${v.publicCode}. Anyone can check it at ${v.checkUrl}. The hospital will contact you.${ambulance}`;
      }
      if (v.event === 'alerted') return `Golden Hour: ${v.facilityName} confirmed. ${v.count} donor${v.count === 1 ? '' : 's'} alerted for request ${v.publicCode}.`;
      if (v.event === 'donor_accepted') return `Golden Hour: a donor has accepted request ${v.publicCode} (${v.count} of ${v.needed} unit${v.needed === 1 ? '' : 's'} covered).`;
      if (v.event === 'donor_en_route') return `Golden Hour: a donor is on the way to ${v.facilityName} for request ${v.publicCode}.`;
      if (v.event === 'donor_arrived') return `Golden Hour: a donor has arrived at ${v.facilityName} for request ${v.publicCode}.`;
      if (v.event === 'rejected') return `Golden Hour: ${v.facilityName} could not take your online request. Please call or visit the hospital directly.`;
      const why = v.outcome === 'fulfilled' ? 'the need has been met' : v.outcome === 'expired' ? 'it has expired' : 'it was cancelled';
      return `Golden Hour: request ${v.publicCode} at ${v.facilityName} is closed — ${why}.`;
    }
  }
}

const deadlineFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function formatDeadline(d: Date): string {
  return `${deadlineFormat.format(d)} IST`;
}
