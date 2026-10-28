import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128);

export const loginSchema = z.object({
  email: emailSchema,
  // Login never reveals password rules; any non-empty string is checked against the hash.
  password: z.string().min(1, 'enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
