'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { bag, formatUSD } from '@/hooks/useBag';
import { describeDesign, type PendantDesign } from '@/lib/commerce/design';
import './AddToBagPanel.css';

interface Snapshot { design: PendantDesign; thumbnail: string | null }
interface Quote { unitAmount: number; grams: number; metal: string }

const RETRY_MS = 500;
const RETRY_LIMIT = 30; // ~15 s before concluding there is no pendant

// Asks the chart engine (which owns the canvas) for the current design.
function requestSnapshot(canvas: HTMLCanvasElement | null): Snapshot | null {
  let result: Snapshot | null = null;
  canvas?.dispatchEvent(new CustomEvent('design-snapshot', { detail: { respond: (s: Snapshot | null) => { result = s; } } }));
  return result;
}

export default function AddToBagPanel({ canvasRef, active }: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'pricing' | 'error' | 'added'>('idle');
  const [error, setError] = useState('');
  const seq = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `attempt` counts retries while the chart is still building the pendant
  // (it finishes a couple of seconds after the aspects animate in).
  const refreshQuote = useCallback(async (attempt = 0) => {
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
    const id = ++seq.current;
    const snap = requestSnapshot(canvasRef.current);
    if (!snap) {
      setQuote(null);
      if (attempt < RETRY_LIMIT) {
        setStatus('waiting');
        retryTimer.current = setTimeout(() => refreshQuote(attempt + 1), RETRY_MS);
      } else {
        setStatus('error');
        setError('Pick at least one aspect to make a pendant.');
      }
      return;
    }
    setStatus('pricing');
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: snap.design }),
      });
      const data = await res.json();
      if (id !== seq.current) return;
      if (!res.ok) throw new Error(data.error || 'Could not price this pendant.');
      setQuote(data);
      setStatus('idle');
    } catch (err) {
      if (id !== seq.current) return;
      setStatus('error');
      setError((err as Error).message);
    }
  }, [canvasRef]);

  useEffect(() => {
    if (!active) return;
    refreshQuote();
    // Re-price when the outline style or liquidity settles.
    const onOutline = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.style || d.final) setTimeout(() => refreshQuote(), 50);
    };
    window.addEventListener('pendant-outline', onOutline);
    return () => {
      window.removeEventListener('pendant-outline', onOutline);
      if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
      seq.current++; // drop any quote still in flight
    };
  }, [active, refreshQuote]);

  async function handleAdd() {
    const snap = requestSnapshot(canvasRef.current);
    if (!snap || !quote) return;
    const { title, subtitle } = describeDesign(snap.design.spec);
    try {
      bag.add({ design: snap.design, title, subtitle, thumbnail: snap.thumbnail, unitAmount: quote.unitAmount });
      setStatus('added');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }

  return (
    <div className="add-to-bag">
      <div className="atb-price-row">
        <span className="atb-price">
          {quote ? formatUSD(quote.unitAmount)
            : status === 'pricing' ? 'Pricing…'
            : status === 'waiting' ? 'Preparing…' : '—'}
        </span>
        {quote && <span className="atb-metal">{quote.metal} · approx. {quote.grams.toFixed(1)} g</span>}
      </div>
      <p className="atb-note">
        Cast to order from your chart. Ships within 3 weeks with free insured shipping in the US.
      </p>

      {status === 'error' && <p className="atb-error">{error}</p>}

      {status === 'added' ? (
        <div className="atb-added">
          <p>Added to your bag.</p>
          <div className="btn-row">
            <button className="controls-back-btn-mobile" onClick={() => setStatus('idle')}>Keep designing</button>
            <Link href="/bag" className="controls-step-btn atb-link">View bag &rarr;</Link>
          </div>
        </div>
      ) : (
        <button className="controls-step-btn" onClick={handleAdd} disabled={!quote || status === 'pricing' || status === 'waiting'}>
          Add to bag
        </button>
      )}
    </div>
  );
}
