import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { FamilyLeadStatus, FamilyLeadView } from '@golden-hour/shared';
import { DataFreshness } from '../../components/ui/DataFreshness';
import { ReasonForm } from '../../components/ui/ReasonForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime, relativeTime } from '../../lib/format';
import { useConfirmLead, useFamilyLeads, useRejectLead } from './api';
import { RequestForm } from './components/RequestForm';

const VIEWS: { id: FamilyLeadStatus | undefined; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'expired', label: 'Expired' },
];

/**
 * Leads sent by families through the public form. A lead never contacts donors: confirming it raises an
 * official request, which still needs verification by a verifier.
 */
export function FamilyLeadsPage() {
  const [status, setStatus] = useState<FamilyLeadStatus | undefined>('pending');
  const q = useFamilyLeads(status);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Family leads</h2>
          <p className="text-xs text-slate-500">
            Inbound urgent requests submitted by patients and families for triage and clinical confirmation.
          </p>
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>
      <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
        {VIEWS.map((v) => (
          <button
            key={v.label}
            type="button"
            aria-pressed={status === v.id}
            onClick={() => setStatus(v.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              status === v.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title="No leads here">Families can send a lead from the public “Ask for help” page.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {q.data!.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadRow({ lead }: { lead: FamilyLeadView }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'confirm' | 'reject' | null>(null);
  const confirm = useConfirmLead();
  const reject = useRejectLead();

  return (
    <li className="card space-y-3.5 border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{lead.reference}</span>
          <span className="font-bold text-slate-900">{lead.contactName}</span>
          <a
            href={`tel:${lead.contactPhone}`}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {lead.contactPhone}
          </a>
          <span className={`rounded-md px-2 py-0.5 text-2xs font-bold ${lead.phoneVerified ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
            {lead.phoneVerified ? 'Number confirmed by SMS code' : 'Number not confirmed'}
          </span>
          {lead.vouch && (
            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-2xs font-bold text-sky-800" title={lead.vouch.note}>
              Vouched by coordinator {lead.vouch.by ?? ''}: “{lead.vouch.note}”
            </span>
          )}
          {lead.bloodGroup && (
            <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700 border border-brand-200">
              {lead.bloodGroup}
            </span>
          )}
        </div>
        <StatusBadge status={lead.status} tone={lead.status === 'pending' ? 'amber' : lead.status === 'confirmed' ? 'green' : 'slate'} />
      </div>

      {lead.note && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700 italic">
          “{lead.note}”
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-slate-500">
        <div>
          Sent {formatDateTime(lead.createdAt)}
          {lead.status === 'pending' && <span className="font-semibold text-amber-700"> · expires {relativeTime(lead.expiresAt)}</span>}
          {lead.decidedBy && ` · ${lead.status} by ${lead.decidedBy}`}
          {lead.reason && ` — “${lead.reason}”`}
        </div>
        {lead.linkedRequest && (
          <Link to={`/hospital/requests/${lead.linkedRequest.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            <span>Open request {lead.linkedRequest.publicCode}</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {lead.status === 'pending' && !mode && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          <button type="button" className="btn-primary text-xs min-h-9 py-1.5" onClick={() => setMode('confirm')}>
            Confirm &amp; raise request
          </button>
          <button
            type="button"
            className="btn-secondary text-xs min-h-9 py-1.5 text-rose-700 hover:text-rose-800"
            onClick={() => {
              reject.reset();
              setMode('reject');
            }}
          >
            Reject
          </button>
        </div>
      )}
      {mode === 'confirm' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            The new request is pending until a verifier confirms it. No donor is contacted before that.
          </p>
          <RequestForm
            initialBloodGroup={lead.bloodGroup}
            pending={confirm.isPending}
            error={confirm.error}
            submitLabel="Raise request"
            onSubmit={(request) =>
              confirm.mutate({ id: lead.id, request }, { onSuccess: (detail) => navigate(`/hospital/requests/${detail.id}`, { state: { created: true } }) })
            }
            secondaryAction={
              <button type="button" className="btn-secondary" onClick={() => setMode(null)}>
                Back
              </button>
            }
          />
        </div>
      )}
      {mode === 'reject' && (
        <ReasonForm
          title="Reject this lead? The family is not notified automatically — call them back."
          confirmLabel="Reject lead"
          danger
          pending={reject.isPending}
          error={reject.error}
          onCancel={() => setMode(null)}
          onConfirm={(reason) => reject.mutate({ id: lead.id, reason }, { onSuccess: () => setMode(null) })}
        />
      )}
    </li>
  );
}
