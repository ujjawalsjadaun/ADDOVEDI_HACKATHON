import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env';
import { TEST_ENV } from '../helpers/testApp';

function problemsFor(env: Record<string, string | undefined>): string[] {
  try {
    loadConfig(env);
  } catch (err) {
    if (err instanceof ConfigError) return err.problems;
    throw err;
  }
  return [];
}

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const config = loadConfig({ ...TEST_ENV });
    expect(config.PORT).toBe(4000);
    expect(config.ESCALATION_STEPS_MIN).toEqual([0, 5, 10, 15]);
    expect(config.DONATION_REST_DAYS).toBe(90);
    expect(config.REQUIRE_SEPARATE_VERIFIER).toBe(true);
    expect(config.DEMO_MODE).toBe(false);
    expect(config.ROUTING_PROVIDER).toBe('simulated');
    expect(config.CLIENT_ORIGIN).toEqual(['http://localhost:5173']);
  });

  it('names every missing required variable', () => {
    const problems = problemsFor({});
    expect(problems).toEqual(
      expect.arrayContaining([
        'MONGODB_URI: is required',
        'SESSION_SECRET: is required',
        'PATIENT_REF_SECRET: is required',
      ]),
    );
  });

  it('treats empty strings as missing', () => {
    expect(problemsFor({ ...TEST_ENV, MONGODB_URI: '' })).toContain('MONGODB_URI: is required');
  });

  it('rejects short secrets without echoing their value', () => {
    const problems = problemsFor({ ...TEST_ENV, SESSION_SECRET: 'tooShortValue' });
    expect(problems).toEqual(['SESSION_SECRET: must be at least 32 characters']);
    expect(problems.join()).not.toContain('tooShortValue');
  });

  it('forbids DEMO_MODE in production', () => {
    expect(problemsFor({ ...TEST_ENV, NODE_ENV: 'production', DEMO_MODE: 'true' })).toEqual([
      'DEMO_MODE: must be false when NODE_ENV=production',
    ]);
  });

  it('requires ORS_API_KEY for the openrouteservice provider', () => {
    expect(problemsFor({ ...TEST_ENV, ROUTING_PROVIDER: 'openrouteservice' })).toEqual([
      'ORS_API_KEY: required when ROUTING_PROVIDER=openrouteservice',
    ]);
  });

  it('rejects a non-increasing escalation ladder', () => {
    expect(problemsFor({ ...TEST_ENV, ESCALATION_STEPS_MIN: '0,10,5' })).toEqual([
      'ESCALATION_STEPS_MIN: must be strictly increasing',
    ]);
  });

  it('rejects malformed booleans and URIs', () => {
    expect(problemsFor({ ...TEST_ENV, DEMO_MODE: 'yes', MONGODB_URI: 'postgres://x' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/^DEMO_MODE:/), expect.stringMatching(/^MONGODB_URI:/)]),
    );
  });
});
