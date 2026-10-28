import { randomBytes } from 'node:crypto';
import { maskPhone } from '../../lib/mask';
import { isDuplicateKeyError } from '../../lib/transaction';
import { SimulatedSmsModel } from './simulatedSms.model';
import type { SmsProvider, SmsSendResult } from './sms.provider';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Never contacts a phone. Records the message (masked number) for the admin screen, dedupes on the
 * idempotency key like a real provider, and can fail a share of sends to demonstrate retries.
 */
export class SimulatedSmsProvider implements SmsProvider {
  readonly name = 'simulated';
  readonly simulated = true;

  constructor(private readonly failureRate: number) {}

  async send(msg: { to: string; body: string; idempotencyKey: string }): Promise<SmsSendResult> {
    const existing = await SimulatedSmsModel.findOne({ idempotencyKey: msg.idempotencyKey }).lean();
    if (existing) return { status: 'accepted', providerMessageId: existing.providerMessageId };

    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      return { status: 'failed', errorCode: 'SIMULATED_TRANSIENT_FAILURE', permanent: false };
    }

    const providerMessageId = `sim_${randomBytes(9).toString('base64url')}`;
    try {
      await SimulatedSmsModel.create({
        idempotencyKey: msg.idempotencyKey,
        providerMessageId,
        toMasked: maskPhone(msg.to) ?? '—',
        body: msg.body,
        expiresAt: new Date(Date.now() + RETENTION_MS),
      });
      return { status: 'accepted', providerMessageId };
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const again = await SimulatedSmsModel.findOne({ idempotencyKey: msg.idempotencyKey }).lean();
        if (again) return { status: 'accepted', providerMessageId: again.providerMessageId };
      }
      return { status: 'failed', errorCode: 'SIMULATED_STORE_ERROR', permanent: false };
    }
  }
}
