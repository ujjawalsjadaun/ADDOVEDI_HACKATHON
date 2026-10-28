import { Link } from 'react-router';

type Tone = 'neutral' | 'attention' | 'danger' | 'good';

const TONE: Record<Tone, string> = {
  neutral: 'border-slate-200',
  attention: 'border-amber-300 bg-amber-50',
  danger: 'border-red-300 bg-red-50',
  good: 'border-emerald-200 bg-emerald-50',
};

/** A single count; becomes `attention` automatically when a non-zero value needs someone to act. */
export function StatCard({ label, value, to, tone, alertWhenNonZero }: { label: string; value: number; to?: string; tone?: Tone; alertWhenNonZero?: Tone }) {
  const t = tone ?? (alertWhenNonZero && value > 0 ? alertWhenNonZero : 'neutral');
  const body = (
    <>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </>
  );
  const className = `block rounded-lg border bg-white p-4 ${TONE[t]}`;
  return to ? (
    <Link to={to} className={`${className} hover:border-brand-600`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
