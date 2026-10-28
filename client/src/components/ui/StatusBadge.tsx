const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-800 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
} as const;

export type BadgeTone = keyof typeof TONES;

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  verified: 'green',
  active: 'green',
  pending: 'amber',
  paused: 'amber',
  rejected: 'red',
  suspended: 'red',
};

export function StatusBadge({ status, label, tone }: { status: string; label?: string; tone?: BadgeTone }) {
  const toneClass = TONES[tone ?? TONE_BY_STATUS[status] ?? 'slate'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
