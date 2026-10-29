import { z } from 'zod';
import { phoneSchema } from './common';

/** An inbound SMS reply from a donor's phone (provider webhook, or an admin-simulated reply). */
export const smsReplySchema = z.object({
  from: phoneSchema,
  body: z.string().trim().min(1).max(160),
});
export type SmsReplyInput = z.infer<typeof smsReplySchema>;

/** A missed call from a donor's registered number means "I am available today" (costs the donor nothing). */
export const missedCallSchema = z.object({ from: phoneSchema });
export type MissedCallInput = z.infer<typeof missedCallSchema>;
