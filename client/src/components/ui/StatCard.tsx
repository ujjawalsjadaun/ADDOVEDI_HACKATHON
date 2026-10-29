import { Link } from 'react-router';

type Tone = 'neutral' | 'attention' | 'danger' | 'good';

const TONE: Record<Tone, { bar: string; bg: string; num: string; pulse: string }> = {
  neutral: { bar: 'bg-slate-300', bg: 'bg-white', num: 'text-slate-900', pulse: '' },
  attention: { bar: 'bg-amber-500', bg: 'bg-amber-50', num: 'text-amber-900', pulse: 'bg-amber-500' },
  danger: { bar: 'bg-brand-600', bg: 'bg-brand-50', num: 'text-brand-700', pulse: 'bg-brand-600' },
  good: { bar: 'bg-emerald-600', bg: 'bg-emerald-50', num: 'text-emerald-800', pulse: '' },
};

/** One metric. Turns amber/red automatically when a non-zero value needs someone to act. */
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
    <>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <p className={`text-3xl font-black leading-none tracking-tight tabular-nums ${style.num}`}>{value.toLocaleString()}</p>
        {style.pulse && value > 0 && <span className={`signal-dot mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${style.pulse}`} aria-hidden="true" />}
      </div>
      <p className="mt-2 pl-1.5 text-[11px] font-bold uppercase leading-snug tracking-wider text-slate-600">{label}</p>
    </>
  );

  const className = `relative block overflow-hidden rounded-xl border border-slate-200 p-4 shadow-xs transition-all duration-150 ${style.bg}`;
  return to ? (
    <Link to={to} className={`${className} hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
