import { Link, useLocation, useParams } from 'react-router';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useRequest } from './api';
import { AssignmentsPanel } from './components/AssignmentsPanel';
import { CandidatesPanel } from './components/CandidatesPanel';
import { TransportPanel } from '../transport/TransportPanel';
import { RequestActions } from './components/RequestActions';
import { Timeline } from './components/Timeline';
import { requestState, URGENCY_LABEL, URGENCY_TONE } from '../../lib/labels';

/** Shared by the hospital area and the admin area (`basePath` decides where links go). */
export function RequestDetailPage({ basePath = '/hospital/requests' }: { basePath?: string }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const flash = location.state as { created?: boolean; possibleDuplicate?: boolean } | null;
  const query = useRequest(id);

  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const r = query.data!;
  const state = requestState(r);
  const active = r.requestStatus !== 'closed';

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={basePath} className="text-sm text-slate-600 hover:underline">
          ← Back to requests
        </Link>
        <DataFreshness
          updatedAt={query.dataUpdatedAt}
          staleAfterMs={60_000}
          isFetching={query.isFetching}
          isError={query.isError}
          onRefresh={() => void query.refetch()}
        />
      </div>

      {flash?.created && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Request submitted. It is pending until a verifier at your facility confirms it.
          {flash.possibleDuplicate && ' It was flagged as a possible duplicate and needs review first.'}
        </p>
      )}

      <header className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-50 px-2.5 py-1 text-lg font-bold text-brand-700">{r.bloodGroup}</span>
          <h2 className="font-mono text-lg font-semibold">{r.publicCode}</h2>
          <StatusBadge status={state.label} label={state.label} tone={state.tone} />
          {active && (
            <StatusBadge
              status={r.urgency}
              label={`${URGENCY_LABEL[r.urgency]}${r.urgencyConfirmed ? '' : ' (suggested)'}`}
              tone={URGENCY_TONE[r.urgency]}
            />
          )}
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Item label="Units">
            {r.slotsFilled} of {r.unitsRequested} assigned
          </Item>
          <Item label="Needed by">
            {formatDateTime(r.deadlineAt)}
            {active && ` (${relativeTime(r.deadlineAt)})`}
          </Item>
          <Item label="Donor groups">{r.acceptCompatibleGroups ? 'Compatible groups accepted' : 'Exact match only'}</Item>
          <Item label="Raised">
            {formatDateTime(r.createdAt)} by {r.createdBy.name ?? 'staff'}
          </Item>
          {r.patientLabel && <Item label="Label">{r.patientLabel}</Item>}
          {r.verification && (
            <Item label={r.verificationStatus === 'rejected' ? 'Rejected' : 'Verified'}>
              {formatDateTime(r.verification.at)} by {r.verification.by ?? 'staff'}
            </Item>
          )}
          {r.closure && (
            <Item label="Closed">
              {formatDateTime(r.closure.at)}
              {r.closure.unitsReceived !== null && ` · ${r.closure.unitsReceived} unit(s) received`}
              {r.closure.note && ` · “${r.closure.note}”`}
            </Item>
          )}
        </dl>
        {r.clinicalNote && <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">{r.clinicalNote}</p>}
        <p className="mt-3 text-xs text-slate-500">
          Anyone can check this code at <span className="font-mono">/check/{r.publicCode}</span> — they see only its status, your facility
          name and the blood group.
        </p>
      </header>

      {r.duplicateReview.status !== 'none' && (
        <section className={`card ${r.duplicateReview.status === 'pending' ? 'border-red-200 bg-red-50' : ''}`}>
          <h3 className="font-semibold">Possible duplicate</h3>
          <p className="text-sm text-slate-700">
            {r.duplicateReview.status === 'pending'
              ? 'Similar active requests at your facility. A verifier must decide before this request can be verified.'
              : `Reviewed: ${r.duplicateReview.status === 'distinct' ? 'separate need' : 'duplicate'}${
                  r.duplicateReview.decidedBy ? ` by ${r.duplicateReview.decidedBy}` : ''
                }${r.duplicateReview.reason ? ` — “${r.duplicateReview.reason}”` : ''}.`}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {r.duplicateReview.candidates.map((c) => (
              <li key={c.id}>
                <Link to={`${basePath}/${c.id}`} className="font-mono text-brand-700 underline">
                  {c.publicCode}
                </Link>{' '}
                · {c.bloodGroup}
                {c.patientLabel && ` · ${c.patientLabel}`} · raised {formatDateTime(c.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <RequestActions request={r} />

      <AssignmentsPanel request={r} />

      <CandidatesPanel request={r} />

      <TransportPanel request={r} />

      <section className="card">
        <h3 className="mb-3 font-semibold">Timeline</h3>
        <Timeline events={r.timeline} />
      </section>
    </article>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}
