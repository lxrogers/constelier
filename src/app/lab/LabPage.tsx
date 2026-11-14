'use client';

// /lab: the full configurator with every setting exposed, a preview of the
// same settings on four sample charts, and a 3D-print cart. "Save as
// default" writes src/config/pendant-defaults.json, which /chart reads.

import { useCallback, useEffect, useRef, useState } from 'react';
import NatalChart from '../chart/LabChart';
import LabPanel from './components/LabPanel';
import PreviewGrid from './components/PreviewGrid';
import PrintCart from './components/PrintCart';
import { usePrintCart } from '@/hooks/usePrintCart';
import { LAB_SAMPLES, randomSamples, type LabSample } from '@/config/lab-samples';
import { normalizeParams, withDerived, PENDANT_DEFAULTS, type PendantParams } from '@/config/pendant-params';
import './lab.css';

const DRAFT_KEY = 'constelier-lab-params';
const SAMPLES_KEY = 'constelier-lab-samples';

export default function LabPage() {
  const [saved, setSaved] = useState<PendantParams>(PENDANT_DEFAULTS);
  const [canWrite, setCanWrite] = useState(true);
  const [params, setParams] = useState<PendantParams>(PENDANT_DEFAULTS);
  const [draft, setDraft] = useState(false);
  const [samples, setSamples] = useState<LabSample[]>(LAB_SAMPLES);
  const cart = usePrintCart();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the working settings from last time, and fetch the saved
  // defaults fresh (the bundled copy can lag a save until the next reload).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setParams(normalizeParams(JSON.parse(raw), PENDANT_DEFAULTS));
    } catch {}
    try {
      const saved = JSON.parse(localStorage.getItem(SAMPLES_KEY) || 'null');
      if (Array.isArray(saved) && saved.length === LAB_SAMPLES.length) setSamples(saved);
    } catch {}
    fetch('/api/lab/defaults').then((r) => r.json()).then((d) => {
      if (d?.defaults) setSaved(normalizeParams(d.defaults));
      setCanWrite(!!d?.canWrite);
    }).catch(() => {});
  }, []);

  // Random charts survive a reload until "Standard samples" puts the
  // tuned four back.
  const changeSamples = useCallback((next: LabSample[] | null) => {
    setSamples(next ?? LAB_SAMPLES);
    try {
      if (next) localStorage.setItem(SAMPLES_KEY, JSON.stringify(next));
      else localStorage.removeItem(SAMPLES_KEY);
    } catch {}
  }, []);

  const update = useCallback((next: Partial<PendantParams>, isDraft: boolean) => {
    setParams((p) => {
      const merged = withDerived({ ...p, ...next });
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
    <div className="lab lab-root">
      <NatalChart
        className="lab-top"
        params={params}
        draft={draft}
        urlOverrides={false}
        orbit
        sidePanel={
          <LabPanel params={params} saved={saved} canWrite={canWrite}
            onChange={update} onSave={saveDefaults}
            randomSamples={samples !== LAB_SAMPLES}
            onNewSamples={() => changeSamples(randomSamples(LAB_SAMPLES.length))}
            onStandardSamples={() => changeSamples(null)} />
        }
      />
      <div className="lab-bottom">
        <PreviewGrid samples={samples} params={params} draft={draft} onAddToCart={cart.add} />
        <PrintCart cart={cart} params={params} />
      </div>
    </div>
  );
}
