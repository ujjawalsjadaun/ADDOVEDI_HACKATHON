import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

function respond(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe('api client', () => {
  it('returns the success envelope and sends cookies', async () => {
    const fetchSpy = respond(200, { data: { ok: 1 }, meta: { requestId: 'r1' } });
    const res = await api<{ ok: number }>('/thing');
    expect(res.data.ok).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/thing', expect.objectContaining({ credentials: 'include' }));
  });

  it('serialises JSON bodies with the right content type', async () => {
    const fetchSpy = respond(201, { data: {}, meta: { requestId: 'r2' } });
    await api('/thing', { method: 'POST', body: { a: 1 } });
    const init = fetchSpy.mock.calls[0]![1]!;
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('turns the error envelope into an ApiError', async () => {
    respond(409, {
      error: { code: 'CONFLICT', message: 'Changed', requestId: 'r3', current: { version: 4 } },
    });
    const err = await api('/thing').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'CONFLICT', status: 409, requestId: 'r3', current: { version: 4 } });
  });

  it('reports network failures distinctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/thing')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('handles non-JSON responses without crashing', async () => {
    respond(502, '<html>Bad gateway</html>');
    await expect(api('/thing')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  it('returns data for explicitly accepted non-2xx statuses', async () => {
    respond(503, { data: { status: 'degraded' }, meta: { requestId: 'r4' } });
    const res = await api<{ status: string }>('/health/ready', { acceptStatus: [503] });
    expect(res.data.status).toBe('degraded');
  });
});
