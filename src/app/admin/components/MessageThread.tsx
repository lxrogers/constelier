import type { Message } from '@/lib/db/schema';
import { dateTime } from './format';

// The whole conversation with one customer, email and text together.
export default function MessageThread({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <p className="admin-sub">No messages yet.</p>;
  return (
    <ol className="admin-thread">
      {messages.map((m) => (
        <li key={m.id} className={`admin-msg is-${m.direction}`}>
          <p className="admin-msg-meta">
            {m.direction === 'in' ? 'They wrote' : 'You wrote'} by {m.channel === 'sms' ? 'text' : 'email'} · {dateTime(m.sentAt ?? m.createdAt)}
            {m.direction === 'out' && m.deliveryStatus && m.deliveryStatus !== 'sent' ? ` · ${m.deliveryStatus}` : ''}
          </p>
          {m.subject && <p className="admin-msg-subject">{m.subject}</p>}
          <p className="admin-msg-body">{m.body}</p>
          {m.mediaUrls?.map((url) => (
            <p key={url}><a href={url} target="_blank" rel="noreferrer">Attachment</a></p>
          ))}
        </li>
      ))}
    </ol>
  );
}
