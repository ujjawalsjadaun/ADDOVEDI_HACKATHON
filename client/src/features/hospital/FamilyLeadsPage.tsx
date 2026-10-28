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
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Family leads</h2>
          <p className="text-sm text-slate-600">
            Call the family back on their number, confirm the patient and the need, then raise an official request — or reject the lead.
          </p>
        </div>
        <DataFreshness updatedAt={q.dataUpdatedAt} staleAfterMs={90_000} isFetching={q.isFetching} isError={q.isError} onRefresh={() => void q.refetch()} />
      </div>
      <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.label}
            type="button"
            aria-pressed={status === v.id}
            onClick={() => setStatus(v.id)}
            className={`rounded-full px-3 py-1 text-sm ${status === v.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'}`}
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
    <li className="card space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-slate-500">{lead.reference}</span>
        <span className="font-semibold">{lead.contactName}</span>
        <a href={`tel:${lead.contactPhone}`} className="text-sm font-medium text-brand-700 underline">
          {lead.contactPhone}
        </a>
        {lead.bloodGroup && <span className="rounded bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{lead.bloodGroup}</span>}
        <StatusBadge status={lead.status} tone={lead.status === 'pending' ? 'amber' : lead.status === 'confirmed' ? 'green' : 'slate'} />
      </div>
      {lead.note && <p className="text-sm text-slate-700">“{lead.note}”</p>}
      <p className="text-xs text-slate-500">
        Sent {formatDateTime(lead.createdAt)}
        {lead.status === 'pending' && ` · expires ${relativeTime(lead.expiresAt)}`}
        {lead.decidedBy && ` · ${lead.status} by ${lead.decidedBy}`}
        {lead.reason && ` — “${lead.reason}”`}
      </p>
      {lead.linkedRequest && (
        <Link to={`/hospital/requests/${lead.linkedRequest.id}`} className="text-sm font-medium text-brand-700 underline">
          Open request {lead.linkedRequest.publicCode}
        </Link>
      )}

      {lead.status === 'pending' && !mode && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => setMode('confirm')}>
            Confirm &amp; raise request
          </button>
          <button
            type="button"
            className="btn-secondary text-red-700"
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
