import type { Config } from '../../config/env';
import { SimulatedSmsProvider } from './simulated';

// SMS adapter boundary (docs/architecture.md §5). `accepted` means the provider took the message —
// not that it reached the phone. Delivery is only known from a provider receipt (webhook).

export type SmsSendResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'failed'; errorCode: string; permanent: boolean };

export interface SmsProvider {
  readonly name: string;
  readonly simulated: boolean;
  /** `idempotencyKey` must make a repeated send of the same message a no-op at the provider. */
  send(msg: { to: string; body: string; idempotencyKey: string }): Promise<SmsSendResult>;
}

let provider: SmsProvider | undefined;

export function getSmsProvider(config: Config): SmsProvider {
  provider ??= new SimulatedSmsProvider(config.SIMULATED_SMS_FAILURE_RATE);
  return provider;
}
