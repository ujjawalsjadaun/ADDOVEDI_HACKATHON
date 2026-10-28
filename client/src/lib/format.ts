const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/** "29 Oct, 14:05" in India time (all timestamps are stored in UTC). */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

/** "in 3 h 20 min", "12 min ago". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60_000);
  const abs = Math.abs(diffMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  return diffMin >= 0 ? `in ${span}` : `${span} ago`;
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
