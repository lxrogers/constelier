'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { sendMessage, type FormState } from '../actions';

interface ChannelOption { id: 'email' | 'sms'; label: string; ready: boolean }

// Writes an email or a text to the customer on this request.
export default function Composer({ env, requestId, channels, preferred, subject, offerLink }: {
  env: string;
  requestId: string;
  channels: ChannelOption[];
  preferred: 'email' | 'sms';
  subject: string;
  offerLink: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage.bind(null, env, requestId), {});
  const [channel, setChannel] = useState(channels.find((c) => c.id === preferred)?.id ?? channels[0]?.id ?? 'email');
  const [body, setBody] = useState('');
  const sent = useRef(state);
  useEffect(() => {
    // Clear the box once a message has gone.
    if (state !== sent.current && state.ok) setBody('');
    sent.current = state;
  }, [state]);

  if (channels.length === 0) return <p className="admin-sub">This customer has no email or phone on file.</p>;
  const current = channels.find((c) => c.id === channel) ?? channels[0];

  return (
    <form action={action} className="admin-form admin-composer">
      <input type="hidden" name="channel" value={current.id} />
      {channels.length > 1 && (
        <div className="admin-switch" role="radiogroup" aria-label="Send by">
          {channels.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={c.id === current.id} className={c.id === current.id ? 'on' : ''} onClick={() => setChannel(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {current.id === 'email' && (
        <input name="subject" type="text" defaultValue={subject ? (subject.startsWith('Re:') ? subject : `Re: ${subject}`) : ''} placeholder="Subject (Your Constelier pendant)" aria-label="Subject" maxLength={200} />
      )}
      <textarea
        name="body" rows={current.id === 'sms' ? 3 : 7} required value={body} onChange={(e) => setBody(e.target.value)}
        aria-label="Message" placeholder={current.id === 'sms' ? 'Text message' : 'Email'}
      />
      {!current.ready && !state.error && <p className="admin-sub">{current.label} is not set up yet, so this will not send.</p>}
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      <div className="admin-form-foot">
        <button type="submit" className="admin-btn" disabled={pending}>{pending ? 'Sending…' : `Send ${current.label.toLowerCase()}`}</button>
        {offerLink && (
          <button type="button" className="admin-link" onClick={() => setBody((b) => `${b}${b && !b.endsWith('\n') ? '\n' : ''}${offerLink}`)}>
            Insert pendant page link
          </button>
        )}
        {state.ok && !pending && <span className="admin-ok">{state.ok}</span>}
      </div>
    </form>
  );
}
