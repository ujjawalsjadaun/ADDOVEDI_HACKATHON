import { useState } from 'react';
import type { Candidate, RequestDetail } from '@golden-hour/shared';
import { EtaBadge } from '../../../components/ui/EtaBadge';
import { ErrorState, LoadingState } from '../../../components/ui/states';
import { useCandidates } from '../api';

/** Read-only preview of who the next batch would alert, in ranked order. */
export function CandidatesPanel({ request }: { request: RequestDetail }) {
  const [open, setOpen] = useState(false);
  const candidates = useCandidates(request.id, open);
  if (request.requestStatus === 'closed') return null;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Matching donors</h3>
        <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show ranked donors'}
        </button>
      </div>
      {open &&
        (candidates.isPending ? (
          <LoadingState />
        ) : candidates.isError ? (
          <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Verified, consenting, available donors with {request.acceptCompatibleGroups ? 'a compatible' : 'the same'} blood group, outside
              their rest period and not already alerted for this request ({candidates.data.alreadyAlerted} alerted so far)
              {candidates.data.cooldownRelaxed ? '. Contact cooldown relaxed for later batches.' : '.'} Ranked by whether they can arrive
              before the deadline, then travel time. This is not a medical eligibility check.
            </p>
            <CandidateList title="Next to be alerted" items={candidates.data.ranked} empty="No eligible donor found right now." />
            {candidates.data.manualReview.length > 0 && (
              <CandidateList
                title="Last donation date unknown — not alerted automatically"
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
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className={`mt-1 divide-y divide-slate-100 text-sm ${muted ? 'text-slate-500' : ''}`}>
          {items.map((c) => (
            <li key={c.donorUserId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                <span className="mr-2 inline-block w-6 text-right text-slate-400">{c.rank}.</span>
                <span className="font-medium">{c.name}</span> ({c.bloodGroup}){c.anchorLabel && ` · ${c.anchorLabel}`}
              </span>
              <span className="flex items-center gap-2">
                <EtaBadge eta={c.eta} />
                {c.beforeDeadline === false && <span className="text-xs font-medium text-red-700">likely after deadline</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
