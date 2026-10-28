/** Outbound JSON request with a hard timeout. Throws on network error, timeout, non-2xx or non-JSON. */
export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs: number }): Promise<T> {
  const { timeoutMs, ...rest } = init;
  const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}
