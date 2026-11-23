'use client';

import { useState, type RefObject } from 'react';
import Link from 'next/link';
import MakerAvatar from '@/components/MakerAvatar';
import { MAKER } from '@/config/maker';
import { QUOTE_RANGES } from '@/config/quote-ranges';
import { formatUSD } from '@/lib/commerce/format';
import { describeDesign, designQuery } from '@/lib/commerce/design';
import { OFFER_PREVIEW_KEY, type OfferPreview } from '@/lib/commerce/offer';
import { requestSnapshot } from './design-snapshot';
import './QuoteRequestPanel.css';

function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 11.5L11.5 4.5" />
      <path d="M5.5 4.5H11.5V10.5" />
    </svg>
  );
}

function MakerSignature() {
  return (
    <div className="quote-signature">
      <MakerAvatar size={26} />
      <span className="quote-maker-name">{MAKER.name}</span>
    </div>
  );
}

// Quote requests land in this Formspree form (https://formspree.io).
const FORMSPREE_ID = 'xjgeozgv';

type Channel = 'email' | 'text';

// The configurator's last step: who to send the quote to. The quote itself is
// written by hand and sent later, with a link to that customer's pendant page.
export default function QuoteRequestPanel({ canvasRef, submitted, onSubmitted }: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  submitted: boolean;
  onSubmitted: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [channel, setChannel] = useState<Channel>('text');
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
        <p className="quote-text">
          I’ll review your pendant and reach out with your unique order page. In the meantime, follow along at the bench on Instagram—I share castings, wax models, and finished pieces as I make them.
        </p>
        <a
          href={MAKER.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="controls-step-btn quote-ig-btn"
        >
          <InstagramGlyph />
          <span>Follow {MAKER.instagramHandle}</span>
          <ArrowUpRight />
        </a>
      </div>
    );
  }

  return (
    <div className="quote-request">
      <div className="quote-note">
        <p className="quote-greeting">Hi!</p>
        <p className="quote-text">
          I’m making these in small batches right now, so I review every pendant myself before it’s cast. Request a quote below and I’ll text or email you a private page for your piece with high quality renders and exact pricing. No obligation to order!
        </p>
        <MakerSignature />
      </div>

      <dl className="quote-ranges">
        {QUOTE_RANGES.map((r) => (
          <div key={r.id} className="quote-range">
            <dt>{r.name}</dt>
            <dd>{formatUSD(r.lowCents)} to {formatUSD(r.highCents)}</dd>
          </div>
        ))}
      </dl>

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
            {(['text', 'email'] as const).map((c) => (
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
        {channel === 'text' ? (
          <>
            By requesting a quote, you agree to receive text messages from Constelier about your quote and pendant request. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.{' '}
            <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link>
          </>
        ) : (
          <>
            Your birth details are sent with your request so I can make your pendant, and are never shared.{' '}
            <Link href="/legal/privacy">Privacy</Link>
          </>
        )}
      </p>
    </div>
  );
}
