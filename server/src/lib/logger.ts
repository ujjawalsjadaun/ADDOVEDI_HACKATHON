import { pino, type Logger } from 'pino';

// Never log credentials, session tokens or contact details (docs/security.md §5).
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.phone',
  '*.contactPhone',
  '*.patientRef',
];

export function createLogger(level: string): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: '[redacted]' } });
}
