'use client';

import { useState } from 'react';
import type { usePrintCart } from '@/hooks/usePrintCart';
import { exportPrintCart, downloadBlob } from '@/lib/print-cart';
import type { PendantParams } from '@/config/pendant-params';

interface Props {
  cart: ReturnType<typeof usePrintCart>;
  params: PendantParams;
}

interface Snapshot {
  design: {
    spec: { birth: { year: string; month: string; day: string; hour: string; minute: string; lat: number; lon: number; location: string } };
    geometry: { chords: { a1: number; a2: number }[] };
  };
  thumbnail: string | null;
}

// Asks the main chart for its current pendant (same event the bag uses).
function snapshotMainChart(): Snapshot | null {
  let result: Snapshot | null = null;
  document.getElementById('chart')?.dispatchEvent(new CustomEvent('design-snapshot', {
    detail: { respond: (s: Snapshot | null) => { result = s; } },
  }));
  return result;
}

export default function PrintCart({ cart, params }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addMain() {
    setError(null);
    const snap = snapshotMainChart();
    if (!snap) { setError('The main chart has no pendant yet.'); return; }
    const b = snap.design.spec.birth;
    const place = b.location.split(',')[0].trim();
    cart.add({
      label: `${b.month}/${b.day}/${b.year} ${b.hour.padStart(2, '0')}:${b.minute.padStart(2, '0')}${place ? ' · ' + place : ''}`,
      params: { ...params, aspects: [...params.aspects] },
      chords: snap.design.geometry.chords,
      birth: {
        year: +b.year, month: +b.month, day: +b.day, hour: +b.hour, minute: +b.minute,
        lat: b.lat, lon: b.lon, location: b.location,
      },
      thumbnail: snap.thumbnail,
    });
  }

  async function download() {
    setError(null);
    try {
      const zip = await exportPrintCart(cart.items, (done, total) => setBusy(`Building ${Math.min(done + 1, total)}/${total}…`));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      downloadBlob(zip, `constelier-print-${stamp}.zip`);
    } catch (e) {
      setError('Export failed: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="lab-card lab-cart">
      <div className="lab-cart-head">
        <h2>3D print cart <span className="lab-count">{cart.items.length}</span></h2>
        <button type="button" className="lab-btn" onClick={addMain}>+ Add main preview</button>
      </div>
      {cart.items.length === 0 ? (
        <p className="lab-empty">Add the main preview or any sample. The download is a zip of real-size STLs (mm) plus manifest.json.</p>
      ) : (
        <ul className="lab-cart-list">
          {cart.items.map((it) => (
            <li key={it.id}>
              {it.thumbnail ? <img src={it.thumbnail} alt="" /> : <span className="lab-thumb-ph" />}
              <div className="lab-cart-info">
                <span>{it.label}</span>
                <span className="lab-sample-meta">
                  {it.params.diameterMm} mm · {it.params.outlineStyle} · rim {it.params.borderThickness} / round {it.params.rimRoundness}
                </span>
              </div>
              <button type="button" className="lab-mini" onClick={() => cart.remove(it.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="lab-msg error">{error}</p>}
      <div className="lab-cart-actions">
        <button type="button" className="lab-btn primary" disabled={!cart.items.length || !!busy} onClick={download}>
          {busy || `Download zip (${cart.items.length})`}
        </button>
        <button type="button" className="lab-btn" disabled={!cart.items.length || !!busy} onClick={cart.clear}>Clear</button>
      </div>
    </section>
  );
}
