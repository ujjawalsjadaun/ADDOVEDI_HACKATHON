import { useState, type FormEvent } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { fieldError, FormError, TextAreaField, TextField } from '../../components/ui/form';
import { useVouchForLead } from './api';

/**
 * A local coordinator vouches that a family's request is genuine, using the reference the family gives them.
 * The hospital sees the vouch next to the lead; it is a signal for staff, not a confirmation.
 */
export function VouchPage() {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const vouch = useVouchForLead();

  function submit(e: FormEvent) {
    e.preventDefault();
    vouch.mutate(
      { reference, note },
      {
        onSuccess: () => {
          setReference('');
          setNote('');
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Coordinator" title="Vouch for a family" subtitle="Help a hospital trust a family’s request from your village." />
      <form onSubmit={submit} className="card max-w-xl space-y-3" noValidate>
        <FormError error={vouch.error} />
        {vouch.isSuccess && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
            Recorded. If that reference is a pending request, the hospital now sees your note. You cannot see the family’s details, and the hospital still confirms the request itself.
          </p>
        )}
        <TextField
          label="Family’s reference"
          required
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={fieldError(vouch.error, 'reference')}
          placeholder="The code the family received"
        />
        <TextAreaField
          label="How do you know this family?"
          required
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={fieldError(vouch.error, 'note')}
        />
        <button type="submit" className="btn-primary" disabled={vouch.isPending}>
          {vouch.isPending ? 'Saving…' : 'Vouch for this request'}
        </button>
      </form>
    </div>
  );
}
