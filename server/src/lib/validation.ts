import type { z } from 'zod';
import { isValidObjectId } from 'mongoose';
import { AppError } from './errors';

/** Route `:id` params: anything that is not an ObjectId cannot exist, so answer 404. */
export function parseId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value) || !isValidObjectId(value)) {
    throw new AppError('NOT_FOUND', 'Not found.');
  }
  return value;
}

/** Parses untrusted input; on failure throws 422 VALIDATION_FAILED with one message per field. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    // Zod 4's default for a missing value is "Invalid input: expected string, received undefined".
    const missing = issue.code === 'invalid_type' && /received undefined$/.test(issue.message);
    fields[key] ??= missing ? 'This field is required.' : issue.message;
  }
  throw new AppError('VALIDATION_FAILED', 'Some fields need attention.', { fields });
}
