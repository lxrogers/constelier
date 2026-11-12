'use client';

import { useState } from 'react';
import Link from 'next/link';
import { bag, useBag, formatUSD } from '@/hooks/useBag';
import { designQuery, MAX_QUANTITY } from '@/lib/commerce/design';
import '../bag.css';

export default function BagView() {
  const { items, subtotal } = useBag();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout() {
    setCheckingOut(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((i) => ({ design: i.design, quantity: i.quantity, thumbnail: i.thumbnail })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
      window.location.assign(data.url);
    } catch (err) {
      setError((err as Error).message);
      setCheckingOut(false);
    }
  }

  return (
    <main className="shop-page">
      <div className="shop-card">
        <h1 className="shop-title">Your bag</h1>

        {items.length === 0 ? (
          <div className="bag-empty">
            <p>Your bag is empty.</p>
            <Link href="/chart" className="shop-btn">Design a pendant</Link>
          </div>
        ) : (
          <>
            <ul className="bag-items">
              {items.map((item) => (
                <li key={item.id} className="bag-item">
                  <div className="bag-thumb">
                    {item.thumbnail ? <img src={item.thumbnail} alt="" /> : null}
                  </div>
                  <div className="bag-item-body">
                    <div className="bag-item-head">
                      <span className="bag-item-title">{item.title}</span>
                      <span className="bag-item-price">{formatUSD(item.unitAmount * item.quantity)}</span>
                    </div>
                    <span className="bag-item-sub">{item.subtitle}</span>
                    <div className="bag-item-actions">
                      <label className="bag-qty">
                        Qty
                        <select
                          value={item.quantity}
                          onChange={(e) => bag.setQuantity(item.id, Number(e.target.value))}
                        >
                          {Array.from({ length: MAX_QUANTITY }, (_, n) => (
                            <option key={n + 1} value={n + 1}>{n + 1}</option>
                          ))}
                        </select>
                      </label>
                      <Link href={`/chart?${designQuery(item.design.spec)}`} className="bag-text-btn">Edit design</Link>
                      <button className="bag-text-btn" onClick={() => bag.remove(item.id)}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="bag-summary">
              <div className="bag-row"><span>Subtotal</span><span>{formatUSD(subtotal)}</span></div>
              <div className="bag-row bag-row-muted"><span>Shipping</span><span>Free insured, or express at checkout</span></div>
              <div className="bag-row bag-row-muted"><span>Tax</span><span>Calculated at checkout</span></div>
            </div>

            {error && <p className="shop-error">{error}</p>}

            <button className="shop-btn shop-btn-wide" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? 'Opening secure checkout…' : 'Check out'}
            </button>
            <p className="bag-fineprint">
              Payment is handled by Stripe. US shipping only. Each pendant is cast to order and ships within 3 weeks.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
