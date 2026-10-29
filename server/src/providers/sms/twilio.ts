import type { SmsProvider, SmsSendResult } from './sms.provider';

/**
 * Real SMS through Twilio's REST API. `accepted` only means Twilio queued the message — never that
 * the phone received it. Delivery receipts are not wired, so the outbox never claims `delivered` for these.
 * A repeated send is deduplicated by Twilio's idempotency token (our outbox eventId).
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  readonly simulated = false;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
    private readonly timeoutMs: number,
  ) {}

  async send(msg: { to: string; body: string; idempotencyKey: string }): Promise<SmsSendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'I-Twilio-Idempotency-Token': msg.idempotencyKey,
        },
        body: new URLSearchParams({ To: msg.to, From: this.from, Body: msg.body }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      return { status: 'failed', errorCode: 'TWILIO_NETWORK', permanent: false };
    }
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as { sid?: string } | null;
      return json?.sid ? { status: 'accepted', providerMessageId: json.sid } : { status: 'failed', errorCode: 'TWILIO_BAD_RESPONSE', permanent: false };
    }
    // 429 and 5xx are worth retrying; other 4xx (bad number, unverified sender) will not fix themselves.
    const transient = res.status === 429 || res.status >= 500;
    return { status: 'failed', errorCode: `TWILIO_HTTP_${res.status}`, permanent: !transient };
  }
}
