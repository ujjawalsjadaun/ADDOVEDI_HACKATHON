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
}

export interface RequestClosedVars {
  publicCode: string;
  facilityName: string;
  outcome: 'fulfilled' | 'cancelled' | 'expired';
}

export type TemplateVars = DonorAlertVars | RequestClosedVars;

export function renderSms(type: NotificationType, vars: TemplateVars): string {
  switch (type) {
    case 'donor_alert': {
      const v = vars as DonorAlertVars;
      return (
        `Golden Hour: ${v.facilityName}, ${v.district} needs ${v.bloodGroup} blood by ${v.deadlineText}. ` +
        `Can you come? Answer in the app: ${v.appUrl}/donor . Check it is genuine: ${v.checkUrl} (code ${v.publicCode}).`
      );
    }
    case 'request_closed_for_donor': {
      const v = vars as RequestClosedVars;
      const why = v.outcome === 'fulfilled' ? 'the need has been met' : v.outcome === 'expired' ? 'it has expired' : 'it was cancelled';
      return `Golden Hour: request ${v.publicCode} at ${v.facilityName} is closed — ${why}. You no longer need to come. Thank you.`;
    }
  }
}

const deadlineFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function formatDeadline(d: Date): string {
  return `${deadlineFormat.format(d)} IST`;
}
