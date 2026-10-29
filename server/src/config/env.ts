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
    /**
     * Folder of the built web app (e.g. ../client/dist). When set, the API serves it and falls back to
     * index.html for app routes, so web app, API and WebSockets share one origin and one cookie.
     */
    CLIENT_DIST_DIR: z.string().min(1).optional(),
    DEMO_MODE: bool.default(false),
    ROUTING_PROVIDER: z.enum(['simulated', 'openrouteservice']).default('simulated'),
    ORS_API_KEY: z.string().optional(),
    WEATHER_PROVIDER: z.enum(['simulated', 'open-meteo']).default('simulated'),
    SMS_PROVIDER: z.enum(['simulated', 'twilio']).default('simulated'),
    /** Twilio credentials: server environment only, never committed or logged. Required when SMS_PROVIDER=twilio. */
    TWILIO_ACCOUNT_SID: z.string().min(10).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(10).optional(),
    /** Sender: a Twilio number in E.164 format. */
    TWILIO_FROM: z.string().regex(/^\+[1-9]\d{7,14}$/, 'use international format').optional(),
    /** Base URL of the web app, used for links in SMS (e.g. the public checker). */
    PUBLIC_APP_URL: z.url().default('http://localhost:5173'),
    /** Simulated SMS only: share of sends that fail transiently (0–1), to demonstrate retries. */
    /** Shared secret an SMS provider webhook sends in `x-sms-secret`. Unset = the inbound webhook is disabled (admin simulation still works). */
    INBOUND_SMS_SECRET: secret.optional(),
    SIMULATED_SMS_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),
    OUTBOX_MAX_ATTEMPTS: intIn(1, 20).default(5),
    OUTBOX_POLL_MS: intIn(500, 60_000).default(3000),
    PROVIDER_TIMEOUT_MS: intIn(500, 30_000).default(4000),
    ROUTE_CACHE_TTL_MIN: intIn(1, 1440).default(30),
    WEATHER_CACHE_TTL_MIN: intIn(1, 180).default(15),
    /** Rain delay bands (docs/architecture.md §6): moderate 2.5–7.6 mm/h, heavy > 7.6 mm/h. */
    RAIN_DELAY_MODERATE_PCT: intIn(0, 200).default(15),
    RAIN_DELAY_HEAVY_PCT: intIn(0, 300).default(35),
    /** Rain used by the simulated weather provider (demo scenarios). */
    SIMULATED_RAIN_MM_PER_HOUR: z.coerce.number().min(0).max(200).default(0),
    /** A blocked-road report this close to the straight line between donor and hospital makes the ETA unknown. */
    ROAD_REPORT_CORRIDOR_KM: z.coerce.number().min(0.1).max(20).default(2),
    ESCALATION_STEPS_MIN: minuteList.default([0, 5, 10, 15]),
    /** Multiplier on every escalation step for planned (standard-urgency) requests. 1 = same ladder as emergencies. */
    PLANNED_ESCALATION_FACTOR: z.coerce.number().min(1).max(10).default(3),
    /** False-request strikes after which a verified facility is suspended automatically. */
    HOSPITAL_STRIKE_LIMIT: intIn(1, 20).default(3),
    /** Minutes after a donor's estimated arrival before the slot is released automatically. */
    NO_SHOW_GRACE_MIN: intIn(0, 240).default(30),
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
    if (env.SESSION_SECRET === env.PATIENT_REF_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['PATIENT_REF_SECRET'], message: 'must differ from SESSION_SECRET' });
    }
    if (env.NODE_ENV === 'production') {
      // Cookies are Secure in production and the app must be served over HTTPS.
      if (!env.CLIENT_ORIGIN.every((o) => o.startsWith('https://'))) {
        ctx.addIssue({ code: 'custom', path: ['CLIENT_ORIGIN'], message: 'every origin must start with https:// in production' });
      }
      if (!env.PUBLIC_APP_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['PUBLIC_APP_URL'], message: 'must start with https:// in production' });
      }
    }
    if (env.SMS_PROVIDER === 'twilio') {
      for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when SMS_PROVIDER=twilio' });
      }
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
