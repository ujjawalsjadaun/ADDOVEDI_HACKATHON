// Notification outbox and realtime contracts (docs/architecture.md §7–8).

/**
 * `sent` = the provider accepted the message. It is NOT proof the person received or read it;
 * `delivered` is only set from a provider delivery receipt.
 */
export const NOTIFICATION_STATUSES = ['pending', 'sending', 'sent', 'delivered', 'failed', 'unknown'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TYPES = ['donor_alert', 'request_closed_for_donor', 'family_phone_code', 'family_lead_update'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationView {
  id: string;
  eventId: string;
  type: NotificationType;
  channel: 'sms';
  recipient: { name: string | null; phoneMasked: string | null };
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  /** Rendered message. Templates never contain patient data. */
  body: string;
  request: { id: string; publicCode: string } | null;
  createdAt: string;
  sentAt: string | null;
  nextAttemptAt: string | null;
  canRetry: boolean;
}

export interface NotificationQueueHealth {
  provider: { name: string; simulated: boolean };
  counts: Partial<Record<NotificationStatus, number>>;
  oldestPendingAt: string | null;
}

/** Realtime events carry only what changed; clients refetch details over REST. */
export type RealtimeTopic = 'request' | 'alert' | 'transport' | 'transfer' | 'lead' | 'map' | 'notification';

export interface RealtimeEvent {
  topic: RealtimeTopic;
  id?: string;
  at: string;
}

/** What an inbound SMS reply did. `replyText` is what the donor is told (sent back by the provider webhook). */
export const SMS_REPLY_OUTCOMES = ['accepted', 'declined', 'rejected', 'needs_code', 'no_open_alert', 'unrecognised', 'unknown_sender', 'availability_refreshed'] as const;
export type SmsReplyOutcome = (typeof SMS_REPLY_OUTCOMES)[number];

export interface SmsReplyResult {
  outcome: SmsReplyOutcome;
  replyText: string;
}
