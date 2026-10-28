import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { buildApp, startDb } from '../helpers/testApp';

describe('health and app shell', () => {
  const app = buildApp();

  describe('without a database connection', () => {
    it('GET /api/health/live returns the success envelope', async () => {
      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ status: 'ok' });
      expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
    });

    it('GET /api/health/ready reports db down with 503', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.data).toMatchObject({ status: 'degraded', db: 'down' });
      expect(res.body.data.providers).toEqual({ routing: 'simulated', weather: 'simulated', sms: 'simulated' });
    });
  });

  describe('with a replica-set database', () => {
    let stop: () => Promise<void>;
    beforeAll(async () => {
      ({ stop } = await startDb());
    });
    afterAll(async () => {
      await stop?.();
    });

    it('GET /api/health/ready reports db up', async () => {
      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: 'ready', db: 'up', demoMode: false });
    });

    it('runs multi-document transactions (replica set)', async () => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await mongoose.connection.collection('tx_probe').insertOne({ ok: true }, { session });
        });
      } finally {
        await session.endSession();
      }
      expect(await mongoose.connection.collection('tx_probe').countDocuments()).toBe(1);
    });
  });

  it('unknown API routes return the error envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: res.headers['x-request-id'] });
  });

  it('rejects non-JSON mutations with 415', async () => {
    const res = await request(app).post('/api/health/live').set('Content-Type', 'text/plain').send('hello');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects malformed JSON with 400 and no stack trace', async () => {
    const res = await request(app).post('/api/health/live').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.debug).toBeUndefined();
  });

  it('honours a well-formed incoming X-Request-Id and replaces a malformed one', async () => {
    const good = await request(app).get('/api/health/live').set('X-Request-Id', 'client-req-12345');
    expect(good.headers['x-request-id']).toBe('client-req-12345');
    const bad = await request(app).get('/api/health/live').set('X-Request-Id', 'bad id with spaces');
    expect(bad.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows CORS only for the configured origin', async () => {
    const allowed = await request(app).get('/api/health/live').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await request(app).get('/api/health/live').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
