const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-800 ring-red-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
} as const;

const TONE_BY_STATUS: Record<string, keyof typeof TONES> = {
  verified: 'green',
  active: 'green',
  pending: 'amber',
  paused: 'amber',
  rejected: 'red',
  suspended: 'red',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[TONE_BY_STATUS[status] ?? 'slate'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
