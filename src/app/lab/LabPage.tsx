'use client';

// /lab: the full configurator with every setting exposed, a preview of the
// same settings on four sample charts, and a 3D-print cart. "Save as
// default" writes src/config/pendant-defaults.json, which /chart reads.

import { useCallback, useEffect, useRef, useState } from 'react';
import NatalChart from '../chart/NatalChart';
import LabPanel from './components/LabPanel';
import PreviewGrid from './components/PreviewGrid';
import PrintCart from './components/PrintCart';
import { usePrintCart } from '@/hooks/usePrintCart';
import { normalizeParams, PENDANT_DEFAULTS, type PendantParams } from '@/config/pendant-params';
import './lab.css';

const DRAFT_KEY = 'constelier-lab-params';

export default function LabPage() {
  const [saved, setSaved] = useState<PendantParams>(PENDANT_DEFAULTS);
  const [canWrite, setCanWrite] = useState(true);
  const [params, setParams] = useState<PendantParams>(PENDANT_DEFAULTS);
  const [draft, setDraft] = useState(false);
  const cart = usePrintCart();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the working settings from last time, and fetch the saved
  // defaults fresh (the bundled copy can lag a save until the next reload).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setParams(normalizeParams(JSON.parse(raw), PENDANT_DEFAULTS));
    } catch {}
    fetch('/api/lab/defaults').then((r) => r.json()).then((d) => {
      if (d?.defaults) setSaved(normalizeParams(d.defaults));
      setCanWrite(!!d?.canWrite);
    }).catch(() => {});
  }, []);

  const update = useCallback((next: Partial<PendantParams>, isDraft: boolean) => {
    setParams((p) => {
      const merged = { ...p, ...next };
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(merged)); } catch {}
      }, 300);
      return merged;
    });
    setDraft(isDraft);
  }, []);

  async function saveDefaults(values: Partial<PendantParams>) {
    const res = await fetch('/api/lab/defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error || 'Save failed');
    setSaved(normalizeParams(d.defaults));
  }

  return (
    <div className="lab">
      <NatalChart
        className="lab-top"
        params={params}
        draft={draft}
        urlOverrides={false}
        orbit
        sidePanel={
          <LabPanel params={params} saved={saved} canWrite={canWrite}
            onChange={update} onSave={saveDefaults} />
        }
      />
      <div className="lab-bottom">
        <PreviewGrid params={params} draft={draft} onAddToCart={cart.add} />
        <PrintCart cart={cart} params={params} />
      </div>
    </div>
  );
}
