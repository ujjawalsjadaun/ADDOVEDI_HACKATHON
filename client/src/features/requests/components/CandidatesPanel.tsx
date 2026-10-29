import { useState } from 'react';
import type { Candidate, Reachability, RequestDetail } from '@golden-hour/shared';
import { EtaBadge } from '../../../components/ui/EtaBadge';
import { ErrorState, LoadingState } from '../../../components/ui/states';
import { useCandidates } from '../api';

/** Read-only preview of who the next batch would alert, in ranked order. */
export function CandidatesPanel({ request }: { request: RequestDetail }) {
  const [open, setOpen] = useState(false);
  const candidates = useCandidates(request.id, open);
  if (request.requestStatus === 'closed') return null;

  return (
    <section className="card space-y-3 border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Matching Volunteers</h3>
          <p className="text-xs text-slate-500">Live preview of algorithmic candidate ranking and dispatch readiness</p>
        </div>
        <button type="button" className="btn-secondary text-xs min-h-9 py-1.5" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide preview' : 'Show ranked candidates'}
        </button>
      </div>
      {open &&
        (candidates.isPending ? (
          <LoadingState />
        ) : candidates.isError ? (
          <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
        ) : (
          <div className="space-y-4 border-t border-slate-100 pt-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-2xs text-slate-500 leading-relaxed">
              Verified, consenting, available donors with {request.acceptCompatibleGroups ? 'a compatible' : 'the exact same'} blood group, outside
              their clinical rest period and not already alerted for this request ({candidates.data.alreadyAlerted} alerted so far)
              {candidates.data.cooldownRelaxed ? '. Contact cooldown relaxed for escalation batches.' : '.'} Ranked by deadline feasibility, then road distance.
            </div>
            <ReachabilityBars r={candidates.data.reachability} />
            <CandidateList title="Next in dispatch queue" items={candidates.data.ranked} empty="No eligible donors available at this moment." />
            {candidates.data.manualReview.length > 0 && (
              <CandidateList
                title="Last donation date unconfirmed (manual follow-up required)"
                items={candidates.data.manualReview}
                empty=""
                muted
              />
            )}
          </div>
        ))}
    </section>
  );
}

function CandidateList({ title, items, empty, muted }: { title: string; items: Candidate[]; empty: string; muted?: boolean }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-1">{empty}</p>
      ) : (
        <ol className={`divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/30 text-xs ${muted ? 'text-slate-500' : ''}`}>
          {items.map((c) => (
            <li key={c.donorUserId} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-mono text-2xs font-bold text-slate-700">
                  {c.rank}
                </span>
                <span className="font-semibold text-slate-900">{c.name}</span>
                <span className="font-mono font-bold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.2 text-2xs">
                  {c.bloodGroup}
                </span>
                {c.anchorLabel && <span className="text-slate-500 text-2xs">· {c.anchorLabel}</span>}
              </span>
              <span className="flex items-center gap-2">
                <EtaBadge eta={c.eta} />
                {c.beforeDeadline === false && (
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-2xs font-semibold text-rose-700 border border-rose-200">
                    After deadline
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Who could get here in time, as counts only. Estimates come from road routing, not straight-line distance. */
function ReachabilityBars({ r }: { r: Reachability }) {
  const max = Math.max(1, ...r.bands.map((b) => b.count));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" aria-label="Donor reachability">
      <h4 className="text-sm font-bold text-slate-900">Can anyone get here in time?</h4>
      <p className="mt-0.5 text-xs text-slate-600">
        <strong className="text-emerald-700">{r.beforeDeadline}</strong> eligible donor{r.beforeDeadline === 1 ? '' : 's'} estimated to arrive before the deadline
        {r.afterDeadline > 0 && <>, {r.afterDeadline} after it</>}
        {r.unknown > 0 && <>, {r.unknown} with unknown travel time (not counted)</>}.
      </p>
      <ul className="mt-2 space-y-1">
        {r.bands.map((b) => (
          <li key={b.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-slate-600">{b.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(b.count / max) * 100}%` }} />
            </span>
            <span className="w-5 text-right font-bold tabular-nums">{b.count}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-2xs text-slate-500">Counts the {r.assessed} nearest eligible donors only. No names or places are shown here.</p>
    </div>
  );
}
