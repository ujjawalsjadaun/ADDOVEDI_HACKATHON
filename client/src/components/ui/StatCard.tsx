import { Link } from 'react-router';

type Tone = 'neutral' | 'attention' | 'danger' | 'good';

const TONE: Record<Tone, { border: string; bg: string; text: string; dot: string }> = {
  neutral: { border: 'border-slate-200/90', bg: 'bg-white', text: 'text-slate-900', dot: 'bg-slate-400' },
  attention: { border: 'border-amber-300/80', bg: 'bg-amber-50/60', text: 'text-amber-950', dot: 'bg-amber-500' },
  danger: { border: 'border-rose-300/80', bg: 'bg-rose-50/60', text: 'text-rose-950', dot: 'bg-rose-600' },
  good: { border: 'border-emerald-300/80', bg: 'bg-emerald-50/60', text: 'text-emerald-950', dot: 'bg-emerald-600' },
};

/** A single metric card with auto-attention indicators and high-contrast typography. */
export function StatCard({
  label,
  value,
  to,
  tone,
  alertWhenNonZero,
}: {
  label: string;
  value: number;
  to?: string;
  tone?: Tone;
  alertWhenNonZero?: Tone;
}) {
  const t = tone ?? (alertWhenNonZero && value > 0 ? alertWhenNonZero : 'neutral');
  const style = TONE[t];

  const body = (
    <div className="flex flex-col justify-between gap-1">
      <div className="flex items-center justify-between">
        <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${style.text}`}>
          {value.toLocaleString()}
        </p>
        {t !== 'neutral' && value > 0 && (
          <span className="flex h-2.5 w-2.5 rounded-full" aria-hidden="true">
            <span className={`inline-flex h-full w-full rounded-full ${style.dot} animate-pulse`} />
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 leading-snug">{label}</p>
    </div>
  );

  const className = `block rounded-xl border p-4.5 shadow-2xs transition-all duration-150 ${style.border} ${style.bg}`;
  return to ? (
    <Link to={to} className={`${className} hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-xs active:translate-y-0`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
