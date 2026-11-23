'use client';

import { useActionState } from 'react';
import { saveNotes, type FormState } from '../actions';

// Private notes on a request. The customer never sees them.
export default function NotesForm({ env, requestId, notes }: { env: string; requestId: string; notes: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNotes.bind(null, env, requestId), {});
  return (
    <form action={action} className="admin-form">
      <textarea name="notes" rows={4} defaultValue={notes} aria-label="Notes" placeholder="Only you see these." />
      <div className="admin-form-foot">
        <button type="submit" className="admin-btn is-quiet" disabled={pending}>{pending ? 'Saving…' : 'Save notes'}</button>
        {state.ok && !pending && <span className="admin-ok">{state.ok}</span>}
      </div>
    </form>
  );
}
