/** `{ a: 1, b: undefined, c: '' }` → `?a=1` (empty and undefined values are dropped). */
export function toQueryString(params: object): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}
