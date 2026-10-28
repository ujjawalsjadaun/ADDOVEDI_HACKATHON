const TONES = {
  green: {
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    dot: 'bg-emerald-600',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  red: {
    badge: 'bg-rose-50 text-rose-800 ring-rose-600/20',
    dot: 'bg-rose-600',
  },
  blue: {
    badge: 'bg-sky-50 text-sky-800 ring-sky-600/20',
    dot: 'bg-sky-600',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
} as const;

export type BadgeTone = keyof typeof TONES;

const TONE_BY_STATUS: Record<string, BadgeTone> = {
  verified: 'green',
  active: 'green',
  fulfilled: 'green',
  accepted: 'green',
  donated: 'green',
  distinct: 'green',
  pending: 'amber',
  paused: 'amber',
  under_review: 'amber',
  awaiting_donor: 'amber',
  open: 'blue',
  en_route: 'blue',
  arrived: 'blue',
  donors_assigned: 'blue',
  rejected: 'red',
  suspended: 'red',
  duplicate: 'red',
  failed: 'red',
  closed: 'slate',
  expired: 'slate',
  cancelled: 'slate',
  unknown: 'slate',
};

export function StatusBadge({ status, label, tone, showDot = true }: { status: string; label?: string; tone?: BadgeTone; showDot?: boolean }) {
  const chosenTone = tone ?? TONE_BY_STATUS[status] ?? 'slate';
  const style = TONES[chosenTone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />}
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
