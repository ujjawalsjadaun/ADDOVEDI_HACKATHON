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
    <article className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={basePath} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to requests
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
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-xs">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-emerald-950">Request submitted successfully</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              It is pending until a verifier at your facility confirms it.
              {flash.possibleDuplicate && ' It was flagged as a possible duplicate and needs review first.'}
            </p>
          </div>
        </div>
      )}

      <header className="card space-y-4 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center justify-center rounded-xl bg-brand-50 px-3 py-1 font-mono text-xl font-extrabold text-brand-700 border border-brand-200 shadow-2xs">
              {r.bloodGroup}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-lg font-bold text-slate-900 tracking-tight">{r.publicCode}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-2xs font-semibold text-slate-600">ID: {r.id.slice(0, 8)}</span>
              </div>
              <p className="text-2xs text-slate-500 font-medium">Public Clinical Emergency Request</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={state.label} label={state.label} tone={state.tone} />
            {active && (
              <StatusBadge
                status={r.urgency}
                label={`${URGENCY_LABEL[r.urgency]}${r.urgencyConfirmed ? '' : ' (suggested)'}`}
                tone={URGENCY_TONE[r.urgency]}
              />
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-100 pt-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <dt className="text-2xs font-bold uppercase tracking-wider text-slate-500">Slots / Units</dt>
            <dd className="mt-1 text-sm font-bold text-slate-900">
              {r.slotsFilled} of {r.unitsRequested} assigned
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <dt className="text-2xs font-bold uppercase tracking-wider text-slate-500">Needed by</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {formatDateTime(r.deadlineAt)}
              {active && <span className="block text-2xs font-bold text-brand-700 mt-0.5">{relativeTime(r.deadlineAt)}</span>}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <dt className="text-2xs font-bold uppercase tracking-wider text-slate-500">Matching Criteria</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {r.acceptCompatibleGroups ? 'Compatible groups accepted' : 'Exact match only'}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <dt className="text-2xs font-bold uppercase tracking-wider text-slate-500">Created</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {formatDateTime(r.createdAt)}
              <span className="block text-2xs text-slate-500 mt-0.5">by {r.createdBy.name ?? 'staff'}</span>
            </dd>
          </div>
        </div>

        {(r.patientLabel || r.verification || r.closure) && (
          <dl className="grid gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
            {r.patientLabel && <Item label="Staff Label">{r.patientLabel}</Item>}
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
        )}

        {r.clinicalNote && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
            <strong className="block text-2xs uppercase tracking-wider text-blue-700 mb-0.5">Clinical Note (Staff Only)</strong>
            {r.clinicalNote}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-500">
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Anyone can check this code at <span className="font-mono font-semibold text-slate-700">/check/{r.publicCode}</span> — public verification exposes only verified status, facility name, and blood group without sensitive clinical data.
          </span>
        </div>
      </header>

      {r.review && (
        <section role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <h3 className="font-semibold">Under administrator review</h3>
          <p className="mt-0.5">
            {r.review.by ?? 'An administrator'} paused this request on {formatDateTime(r.review.at)}: “{r.review.reason}”. The public checker shows
            “under review”, and verification and new donor alerts are paused. Cancelling, rejecting and fulfilling remain possible.
          </p>
        </section>
      )}

      {r.requestStatus === 'awaiting_donor' && !r.review && r.escalationStep >= 2 && (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h3 className="font-semibold">No donor yet — escalated</h3>
          <p className="mt-0.5">
            Donors have been alerted without anyone accepting. Check your own blood bank, request stock from another facility under{' '}
            <strong>Stock transfers</strong>
            {r.escalationStep >= 3 ? ', and expect an administrator to contact nearby facilities' : ''}.
          </p>
        </section>
      )}

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
