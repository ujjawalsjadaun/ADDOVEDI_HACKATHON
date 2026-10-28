import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ApiError } from '../../lib/api/client';

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 aria-[invalid=true]:border-red-500';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={inputClass} {...input} />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string };

export function TextAreaField({ label, error, hint, ...input }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy} className={inputClass} rows={3} {...input} />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, error, hint, options, ...select }: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <select id={id} aria-invalid={!!error} aria-describedby={describedBy} className={inputClass} {...select}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" {...input} />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Form-level error banner. Field errors are shown next to fields via `fieldError()`. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fields?.[field] : undefined;
}
