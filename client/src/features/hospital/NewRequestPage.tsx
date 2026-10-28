import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../lib/api/client';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useCreateRequest } from './api';
import { RequestForm } from './components/RequestForm';

export function NewRequestPage() {
  const navigate = useNavigate();
  const create = useCreateRequest();
  // One key per submission attempt; reused on retry so a flaky network can't create two requests.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const err = create.error;
  const existingId = err instanceof ApiError && err.code === 'ACTIVE_REQUEST_EXISTS' ? err.fields?.existingRequestId : undefined;

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link to="/hospital/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to requests
        </Link>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">New blood request</h2>
            <p className="text-xs text-slate-500">
              Clinical requirement protocol · Facility authorization required
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 leading-relaxed">
          <strong>Protocol Note:</strong> The request stays in <span className="font-semibold text-blue-950">pending</span> status until a designated verifier confirms it. No volunteer donors are alerted or contacted prior to clinical verification.
        </div>
      </div>

      <RequestForm
        pending={create.isPending}
        error={err}
        submitLabel="Submit for verification"
        onEdit={() => setIdempotencyKey(newIdempotencyKey())}
        onSubmit={(input) =>
          create.mutate(
            { idempotencyKey, input },
            {
              onSuccess: (result) =>
                navigate(`/hospital/requests/${result.request.id}`, { state: { created: true, possibleDuplicate: result.possibleDuplicate } }),
            },
          )
        }
        notice={
          existingId && (
            <p className="text-sm">
              <Link to={`/hospital/requests/${existingId}`} className="font-medium text-brand-700 underline">
                Open the existing request
              </Link>
            </p>
          )
        }
        secondaryAction={
          <Link to="/hospital/requests" className="btn-secondary">
            Cancel
          </Link>
        }
      />
    </section>
  );
}
