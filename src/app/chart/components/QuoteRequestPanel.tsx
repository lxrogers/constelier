'use client';

import { useState, type RefObject } from 'react';
import Link from 'next/link';
import { QUOTE_RANGES } from '@/config/quote-ranges';
import { formatUSD } from '@/lib/commerce/format';
import { describeDesign, designQuery } from '@/lib/commerce/design';
import { OFFER_PREVIEW_KEY, SAMPLE_OFFER_ID, type OfferPreview } from '@/lib/commerce/offer';
import { requestSnapshot } from './design-snapshot';
import './QuoteRequestPanel.css';

// Quote requests land in this Formspree form (https://formspree.io).
const FORMSPREE_ID = 'xjgeozgv';

type Channel = 'email' | 'text';

// The configurator's last step while the shop is closed: who to send the
// quote to. The quote itself is written by hand and sent later, with a link
// to that customer's pendant page.
export default function QuoteRequestPanel({ canvasRef, submitted, onSubmitted }: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  submitted: boolean;
  onSubmitted: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    const name = firstName.trim();
    const snap = requestSnapshot(canvasRef.current);
    const spec = snap?.design.spec;
    const query = spec ? designQuery(spec) : '';
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          request: 'quote',
          firstName: name,
          [channel === 'email' ? 'email' : 'phone']: contact.trim(),
          birth: spec ? describeDesign(spec).subtitle : '',
          birthtime: spec ? `${spec.birth.hour}:${spec.birth.minute.padStart(2, '0')}` : '',
          design: query ? `${window.location.origin}/chart?${query}` : '',
        }),
      });
      if (!res.ok) throw new Error('send failed');
    } catch {
      setSending(false);
      setError('That did not go through. Please try again.');
      return;
    }
    // For the prototype's "see the pendant page" button below.
    try {
      const preview: OfferPreview = {
        firstName: name,
        subtitle: spec ? describeDesign(spec).subtitle : '',
        thumbnail: snap?.thumbnail ?? null,
        designQuery: query,
        ...(spec ? {
          birth: {
            year: +spec.birth.year, month: +spec.birth.month, day: +spec.birth.day,
            hour: +spec.birth.hour, minute: +spec.birth.minute,
            lat: spec.birth.lat, lon: spec.birth.lon,
          },
          aspects: spec.aspects,
          design: snap?.design,
        } : {}),
      };
      sessionStorage.setItem(OFFER_PREVIEW_KEY, JSON.stringify(preview));
    } catch {
      // Private mode or a full store: the sample page shows its own pendant.
    }
    onSubmitted();
  }

  if (submitted) {
    return (
      <div className="quote-request quote-thanks">
        <p className="quote-lede">
          {firstName.trim() ? `Thank you, ${firstName.trim()}.` : 'Thank you.'} Look out for a message from me with your quote.
        </p>
        <p className="quote-text">
          It will come with a page for your pendant: photos in each metal, the sizes I would make it in, and the price for each.
        </p>
        <div className="quote-proto">
          <span className="quote-proto-label">Prototype only</span>
          <Link href={`/pendant/${SAMPLE_OFFER_ID}`} className="controls-step-btn quote-proto-btn">
            See the pendant page &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-request">
      <p className="quote-text">
        Each pendant is made to order: cast from your chart, finished by hand, and sized to suit your design.
        Tell me where to reach you and I will send a quote for yours.
      </p>

      <dl className="quote-ranges">
        {QUOTE_RANGES.map((r) => (
          <div key={r.id} className="quote-range">
            <dt>{r.name}</dt>
            <dd>{formatUSD(r.lowCents)} to {formatUSD(r.highCents)}</dd>
          </div>
        ))}
      </dl>
      <p className="quote-fine">Most pendants fall in these ranges. Yours depends on its size and how much metal the design uses.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="quote-first-name">First name</label>
          <input
            id="quote-first-name" type="text" required autoComplete="given-name" maxLength={60}
            value={firstName} onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <div className="quote-channel" role="radiogroup" aria-label="How should I send your quote?">
            {(['email', 'text'] as const).map((c) => (
              <button
                key={c} type="button" role="radio" aria-checked={channel === c}
                className={`quote-channel-btn${channel === c ? ' on' : ''}`}
                onClick={() => { setChannel(c); setContact(''); }}
              >
                {c === 'email' ? 'Email me' : 'Text me'}
              </button>
            ))}
          </div>
          {channel === 'email' ? (
            <input
              key="email" type="email" required autoComplete="email" placeholder="you@example.com" aria-label="Email"
              value={contact} onChange={(e) => setContact(e.target.value)}
            />
          ) : (
            <input
              key="tel" type="tel" required autoComplete="tel" placeholder="(555) 555-0123" aria-label="Mobile number"
              pattern="[0-9+()\-.\s]{7,20}" title="A phone number"
              value={contact} onChange={(e) => setContact(e.target.value)}
            />
          )}
        </div>
        {error && <p className="quote-error">{error}</p>}
        <button type="submit" className="controls-step-btn" disabled={sending}>
          {sending ? 'Sending…' : 'Request my quote'}
        </button>
      </form>

      <p className="quote-fine">
        Your birth date, time and place are sent with your request so I can make your pendant. They are not shared with anyone else.
      </p>
    </div>
  );
}
