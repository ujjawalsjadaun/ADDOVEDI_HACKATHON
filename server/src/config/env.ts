import { z } from 'zod';

// Environment contract: docs/architecture.md §9.
// Zod 4: `.default()` takes the *output* type and skips parsing, so defaults below are typed values.

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const intIn = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const minuteList = z
  .string()
  .transform((s) => s.split(',').map((p) => Number(p.trim())))
  .pipe(z.array(z.number().int().min(0).max(240)).min(1))
  .refine((steps) => steps.every((v, i) => i === 0 || v > steps[i - 1]!), 'must be strictly increasing');

const originList = z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean));

const secret = z.string().min(32, 'must be at least 32 characters');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: intIn(1, 65535).default(4000),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
    SESSION_SECRET: secret,
    PATIENT_REF_SECRET: secret,
    SESSION_TTL_HOURS: intIn(1, 72).default(8),
    CLIENT_ORIGIN: originList.default(['http://localhost:5173']),
    TRUST_PROXY: bool.default(false),
    DEMO_MODE: bool.default(false),
    ROUTING_PROVIDER: z.enum(['simulated', 'openrouteservice']).default('simulated'),
    ORS_API_KEY: z.string().optional(),
    WEATHER_PROVIDER: z.enum(['simulated', 'open-meteo']).default('simulated'),
    SMS_PROVIDER: z.enum(['simulated']).default('simulated'),
    PROVIDER_TIMEOUT_MS: intIn(500, 30_000).default(4000),
    ROUTE_CACHE_TTL_MIN: intIn(1, 1440).default(30),
    ESCALATION_STEPS_MIN: minuteList.default([0, 5, 10, 15]),
    ALERT_BATCH_SIZE: intIn(1, 20).default(3),
    ALERT_RESPONSE_WINDOW_MIN: intIn(1, 120).default(5),
    DONATION_REST_DAYS: intIn(1, 365).default(90),
    CONTACT_COOLDOWN_HOURS: intIn(0, 720).default(24),
    VERIFICATION_DEADLINE_MIN: intIn(1, 1440).default(30),
    REQUIRE_SEPARATE_VERIFIER: bool.default(true),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEMO_MODE) {
      ctx.addIssue({ code: 'custom', path: ['DEMO_MODE'], message: 'must be false when NODE_ENV=production' });
    }
    if (env.ROUTING_PROVIDER === 'openrouteservice' && !env.ORS_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['ORS_API_KEY'], message: 'required when ROUTING_PROVIDER=openrouteservice' });
    }
  });

export type Config = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** Parses environment variables. Error messages name the variable but never echo its value. */
export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  // Treat empty strings as unset so `FOO=` in .env falls back to the default / required error.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => {
        const name = issue.path.join('.') || '(root)';
        const missing = issue.code === 'invalid_type' && !(String(issue.path[0]) in cleaned);
        return `${name}: ${missing ? 'is required' : issue.message}`;
      }),
    );
  }
  return result.data;
}
