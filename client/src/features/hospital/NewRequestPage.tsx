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
    <section className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/hospital/requests" className="text-sm text-slate-600 hover:underline">
          ← Back to requests
        </Link>
        <h2 className="mt-1 text-lg font-semibold">New blood request</h2>
        <p className="text-sm text-slate-600">
          The request stays <strong>pending</strong> until a verifier at your facility confirms it. No donor is contacted before
          verification.
        </p>
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
