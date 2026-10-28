import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  normalizePublicCode,
  SUSPICIOUS_REPORT_CATEGORIES,
  type PublicRequestStatus,
  type SuspiciousReportCategory,
} from '@golden-hour/shared';
import { FormError, SelectField, TextAreaField } from '../../components/ui/form';
import { ErrorState, LoadingState } from '../../components/ui/states';
import { formatDateTime } from '../../lib/format';
import { usePublicStatus, useReportSuspicious } from './api';

type Found = Exclude<PublicRequestStatus, { status: 'not_found' }>;

const VERDICT: Record<Found['status'], { title: string; body: string; tone: string; badge: string; icon: string }> = {
  verified_active: {
    title: 'Genuine and Actively Seeking Donors',
    body: 'A registered medical facility has confirmed clinical urgency. This emergency request is actively matching reachable volunteer donors.',
    tone: 'border-emerald-300/80 bg-emerald-50/80 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icon: 'verified',
  },
  pending_verification: {
    title: 'Pending Medical Verification',
    body: 'This request was logged by staff but has not yet passed two-person verifier authorization. Do not mobilize until fully verified.',
    tone: 'border-amber-300/80 bg-amber-50/80 text-amber-950',
    badge: 'bg-amber-600 text-white',
    icon: 'pending',
  },
  under_review: {
    title: 'Temporarily Under Review',
    body: 'This request has been flagged for administrative review. Donors should not travel until review clears.',
    tone: 'border-amber-300/80 bg-amber-50/80 text-amber-950',
    badge: 'bg-amber-600 text-white',
    icon: 'pending',
  },
  closed_fulfilled: {
    title: 'Closed — Clinical Need Fulfilled',
    body: 'The treating hospital has confirmed this need was successfully met. Thank you! Please do not forward this message further.',
    tone: 'border-slate-300/80 bg-slate-50/90 text-slate-900',
    badge: 'bg-slate-700 text-white',
    icon: 'closed',
  },
  closed_cancelled: {
    title: 'Closed — Cancelled by Facility',
    body: 'This request was formally cancelled by the hospital facility. Please stop forwarding this code.',
    tone: 'border-slate-300/80 bg-slate-50/90 text-slate-900',
    badge: 'bg-slate-700 text-white',
    icon: 'closed',
  },
  closed_expired: {
    title: 'Expired — Deadline Elapsed',
    body: 'This request passed its surgical/transfusion deadline and has been closed by the escalation worker.',
    tone: 'border-slate-300/80 bg-slate-50/90 text-slate-900',
    badge: 'bg-slate-700 text-white',
    icon: 'closed',
  },
  rejected: {
    title: 'Not a Valid Request',
    body: 'The facility verifier rejected this request. It is invalid and should not be shared or acted upon.',
    tone: 'border-rose-300/80 bg-rose-50/80 text-rose-950',
    badge: 'bg-rose-600 text-white',
    icon: 'rejected',
  },
};

const CATEGORY_LABEL: Record<SuspiciousReportCategory, string> = {
  fake_request: 'Fabricated or fake request',
  wrong_details: 'Details in the message are incorrect',
  harassment: 'Being used to harass or scam',
  other: 'Other concern',
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
      setInputError('Please enter a valid code format (e.g. GH-7K2M-Q9ZT)');
      return;
    }
    setInputError(undefined);
    setInput(normalised);
    navigate(`/check/${normalised}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 py-4 sm:py-8">
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM4.75 8a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5A.75.75 0 0 1 4.75 8Z" clipRule="evenodd" />
          </svg>
          Public Verification Registry
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Is this request real?</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Verify whether an emergency blood request message is genuine, hospital-authorized, and actively looking for donors.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card rounded-2xl p-6 sm:p-7 shadow-xs space-y-4" noValidate>
        <div>
          <label htmlFor="public-code-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Emergency Request Code
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="public-code-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="GH-7K2M-Q9ZT"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3 font-mono text-base font-bold uppercase tracking-wider text-slate-900 shadow-2xs transition-all placeholder:text-slate-400 placeholder:font-normal focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <button type="submit" className="btn-primary h-12 px-6 text-sm font-bold shadow-xs">
              Verify Code
            </button>
          </div>
          {inputError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-.75 8a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" clipRule="evenodd" />
              </svg>
              {inputError}
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Accepts codes copied directly from SMS or WhatsApp forwards (e.g. <span className="font-mono font-medium text-slate-700">GH 7K2M Q9ZT</span>).
        </p>
      </form>

      {code && (
        result.isPending ? (
          <LoadingState label="Verifying code with registry…" />
        ) : result.isError ? (
          <ErrorState error={result.error} onRetry={() => void result.refetch()} />
        ) : (
          <ResultCard status={result.data} code={code} />
        )
      )}

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs text-slate-500 leading-relaxed">
        <span className="font-semibold text-slate-700">Privacy Notice:</span> This verification service never exposes patient identities, contact details, or precise hospital locations to anonymous viewers.
      </div>
    </div>
  );
}

function ResultCard({ status, code }: { status: PublicRequestStatus; code: string }) {
  if (status.status === 'not_found') {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div role="status" className="rounded-2xl border border-rose-300/80 bg-rose-50/80 p-6 sm:p-7 text-rose-950 shadow-2xs space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
            Unregistered Code
          </div>
          <h2 className="text-xl font-bold tracking-tight">Code Not Found in Registry</h2>
          <p className="text-sm leading-relaxed text-rose-900">
            No active or archived blood request matching <span className="font-mono font-bold">{code}</span> was ever issued by a verified hospital on Golden Hour. Check for typos. If someone circulated this code as an emergency appeal, please report it below to alert administrators.
          </p>
        </div>
        <ReportForm code={code} />
      </section>
    );
  }

  const verdict = VERDICT[status.status];

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div role="status" className={`rounded-2xl border p-6 sm:p-7 shadow-xs space-y-4 ${verdict.tone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-3">
          <div className="font-mono text-base font-extrabold tracking-wider">{status.code}</div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${verdict.badge}`}>
            {verdict.title}
          </span>
        </div>

        <p className="text-sm leading-relaxed font-medium">{verdict.body}</p>

        <div className="rounded-xl bg-white/70 p-4 ring-1 ring-black/5 backdrop-blur-2xs">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Blood Group</dt>
              <dd className="mt-0.5 text-lg font-extrabold text-slate-900">{status.bloodGroup}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Facility & District</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {status.facilityName} <span className="font-normal text-slate-600 block text-xs">{status.district}</span>
              </dd>
            </div>
            {status.deadlineAt && (
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Needed Before</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(status.deadlineAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Last System Update</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(status.updatedAt)}</dd>
            </div>
          </dl>
        </div>
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
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
        Thank you. Your report has been submitted to system administrators for audit.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="pt-2 text-center">
        <button
          type="button"
          className="text-xs font-semibold text-rose-700 hover:text-rose-800 underline transition-colors"
          onClick={() => setOpen(true)}
        >
          Notice something suspicious about this request? Submit a report &rarr;
        </button>
      </div>
    );
  }

  return (
    <form
      className="card rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in duration-150"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        report.mutate({ publicCode: code, category, note: note || undefined });
      }}
    >
      <div className="space-y-1">
        <h3 className="font-bold text-slate-900">Report a Suspicious Request</h3>
        <p className="text-xs text-slate-500">Help protect the community from harassment, expired forwards, or fraudulent claims.</p>
      </div>

      <FormError error={report.error} />

      <SelectField
        label="Nature of concern"
        value={category}
        onChange={(e) => setCategory(e.target.value as SuspiciousReportCategory)}
        options={SUSPICIOUS_REPORT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      <TextAreaField
        label="Additional context (optional)"
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint="Please do not include personal names or phone numbers."
        placeholder="Where did you see this code shared?"
      />

      <div className="flex gap-2.5 pt-1">
        <button type="submit" className="btn-primary" disabled={report.isPending}>
          {report.isPending ? 'Submitting…' : 'Submit Report'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
