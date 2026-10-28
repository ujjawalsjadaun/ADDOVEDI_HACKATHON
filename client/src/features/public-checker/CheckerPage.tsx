import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  normalizePublicCode,
  SUSPICIOUS_REPORT_CATEGORIES,
  type PublicRequestStatus,
  type SuspiciousReportCategory,
} from '@golden-hour/shared';
import { FormError, SelectField, TextAreaField, TextField } from '../../components/ui/form';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime } from '../../lib/format';
import { usePublicStatus, useReportSuspicious } from './api';

type Found = Exclude<PublicRequestStatus, { status: 'not_found' }>;

const VERDICT: Record<Found['status'], { title: string; body: string; tone: string }> = {
  verified_active: {
    title: 'Genuine and active',
    body: 'A registered facility has verified this request and it is still open.',
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  pending_verification: {
    title: 'Not verified yet',
    body: 'This request was raised by a registered facility but has not been verified. Do not act on it until it is verified.',
    tone: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  under_review: {
    title: 'Under review',
    body: 'This request is being reviewed. Do not act on it for now.',
    tone: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  closed_fulfilled: {
    title: 'Closed — need met',
    body: 'The hospital has confirmed this need was met. No more donors are needed. Please stop forwarding it.',
    tone: 'border-slate-300 bg-slate-50 text-slate-900',
  },
  closed_cancelled: {
    title: 'Closed',
    body: 'This request was closed by the hospital. Please stop forwarding it.',
    tone: 'border-slate-300 bg-slate-50 text-slate-900',
  },
  closed_expired: {
    title: 'Expired',
    body: 'This request passed its deadline and is closed. Please stop forwarding it.',
    tone: 'border-slate-300 bg-slate-50 text-slate-900',
  },
  rejected: {
    title: 'Not a valid request',
    body: 'The facility did not confirm this request. Do not act on it.',
    tone: 'border-red-300 bg-red-50 text-red-900',
  },
};

const CATEGORY_LABEL: Record<SuspiciousReportCategory, string> = {
  fake_request: 'Looks fake',
  wrong_details: 'Details in the message are wrong',
  harassment: 'Being used to harass or scam',
  other: 'Something else',
};

export function CheckerPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code ?? '');
  const [inputError, setInputError] = useState<string>();
  const result = usePublicStatus(code);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalised = normalizePublicCode(input);
    if (!normalised) {
      setInputError('Codes look like GH-7K2M-Q9ZT.');
      return;
    }
    setInputError(undefined);
    setInput(normalised);
    navigate(`/check/${normalised}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Is this request real?</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the code from a blood request message (for example <span className="font-mono">GH-7K2M-Q9ZT</span>) to see whether a
          registered facility verified it and whether it is still open.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1">
          <TextField
            label="Request code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={inputError}
          />
        </div>
        <button type="submit" className="btn-primary">
          Check
        </button>
      </form>

      {code && (result.isPending ? <LoadingState label="Checking…" /> : result.isError ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <ResultCard status={result.data} code={code} />
      ))}

      <p className="text-xs text-slate-500">
        This checker never shows patient, donor or contact details. In an emergency, contact the hospital directly using a number you
        already trust.
      </p>
    </div>
  );
}

function ResultCard({ status, code }: { status: PublicRequestStatus; code: string }) {
  if (status.status === 'not_found') {
    return (
      <section className="space-y-3">
        <div role="status" className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
          <h2 className="text-lg font-semibold">Code not found</h2>
          <p className="mt-1 text-sm">
            No request with this code exists. Check the code for typos. If someone sent you this code as an official request, it may not be
            genuine — please report it.
          </p>
        </div>
        <ReportForm code={code} />
      </section>
    );
  }
  const verdict = VERDICT[status.status];
  return (
    <section className="space-y-3">
      <div role="status" className={`rounded-lg border p-5 ${verdict.tone}`}>
        <p className="font-mono text-sm">{status.code}</p>
        <h2 className="text-lg font-semibold">{verdict.title}</h2>
        <p className="mt-1 text-sm">{verdict.body}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide opacity-75">Blood group</dt>
            <dd className="font-semibold">{status.bloodGroup}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide opacity-75">Facility</dt>
            <dd>
              {status.facilityName}, {status.district}
            </dd>
          </div>
          {status.deadlineAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide opacity-75">Needed by</dt>
              <dd>{formatDateTime(status.deadlineAt)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide opacity-75">Last updated</dt>
            <dd>{formatDateTime(status.updatedAt)}</dd>
          </div>
        </dl>
      </div>
      <ReportForm code={code} />
    </section>
  );
}

function ReportForm({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SuspiciousReportCategory>('fake_request');
  const [note, setNote] = useState('');
  const report = useReportSuspicious();

  if (report.isSuccess) {
    return <p className="text-sm text-slate-700">Thank you. An administrator will review this report.</p>;
  }
  if (!open) {
    return (
      <button type="button" className="text-sm font-medium text-red-700 underline" onClick={() => setOpen(true)}>
        Report this request as suspicious
      </button>
    );
  }
  return (
    <form
      className="card space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        report.mutate({ publicCode: code, category, note: note || undefined });
      }}
    >
      <h3 className="font-semibold">Report a suspicious request</h3>
      <FormError error={report.error} />
      <SelectField
        label="What is wrong?"
        value={category}
        onChange={(e) => setCategory(e.target.value as SuspiciousReportCategory)}
        options={SUSPICIOUS_REPORT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />
      <TextAreaField
        label="Details (optional)"
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint="Do not include anyone's personal details."
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={report.isPending}>
          {report.isPending ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
