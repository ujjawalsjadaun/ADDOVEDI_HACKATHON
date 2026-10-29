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
  event: 'confirmed' | 'rejected' | 'closed';
  facilityName: string;
  publicCode?: string;
  checkUrl?: string;
  outcome?: 'fulfilled' | 'cancelled' | 'expired';
}

export type TemplateVars = DonorAlertVars | RequestClosedVars | FamilyPhoneCodeVars | FamilyLeadUpdateVars;

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
    case 'family_lead_update': {
      const v = vars as FamilyLeadUpdateVars;
      if (v.event === 'confirmed') return `Golden Hour: ${v.facilityName} has confirmed your request and raised an official request, code ${v.publicCode}. Anyone can check it at ${v.checkUrl}. The hospital will contact you.`;
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
