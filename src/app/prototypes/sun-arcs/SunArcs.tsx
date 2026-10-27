'use client';
import { useEffect, useRef, useState } from 'react';
import { defaults, limits, presets } from '@/modules/prototypes/sun-arcs-params';
import './prototype.css';
export default function SunArcs() {
  const [params, setParams] = useState(defaults), [status, setStatus] = useState('Loading preview…'), [busy, setBusy] = useState(true);
  const container = useRef<HTMLDivElement>(null), viewer = useRef<any>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let instance;
    let observer: ResizeObserver;
    let redraw: () => void;
    let frame = 0;
    import('@/modules/three-pendant-viewer').then(({ PendantViewer }) => {
      if (cancelled) return;
      instance = viewer.current = new PendantViewer(container.current, { hdriPath: '/softbox.hdr', enableGroundPlane: false, enablePostProcessing: false, enableEdges: false });
      instance.controls.enableDamping = false;
      redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (!cancelled) instance.renderOnce(); }); };
      instance.controls.addEventListener('change', redraw);
      observer = new ResizeObserver(() => { instance.resize(); instance.renderOnce(); });
      observer.observe(container.current);
      viewer.current.start();
      generate();
    }).catch(e => { if (!cancelled) { setStatus(`Viewer unavailable: ${e.message}`); setBusy(false); } });
    return () => { cancelled = true; alive.current = false; cancelAnimationFrame(frame); observer?.disconnect(); instance?.controls?.removeEventListener('change', redraw); instance?.controls?.dispose(); instance?.dispose(); instance?.renderer.domElement.remove(); };
  }, []);
  async function generate(exportFile = false) {
    setBusy(true); setStatus(exportFile ? 'Preparing STL…' : 'Building solid…');
    try {
      const response = await fetch('/api/prototypes/sun-arcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, ...(exportFile ? { export: 'stl' } : {}) }) });
      if (!response.ok) throw new Error((await response.json()).error);
      if (exportFile) {
        const url = URL.createObjectURL(await response.blob()), a = document.createElement('a'); a.href = url; a.download = 'sun-arcs.stl'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else { const data = await response.json(); if (alive.current) { viewer.current?.updateMeshFromData(data); } }
      if (alive.current) setStatus(exportFile ? 'STL exported in millimetres' : 'Preview matches generated parameters');
    } catch (e) { if (alive.current) setStatus(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <main className="sun-prototype"><header><small>EXPERIMENTAL / 01</small><h1>Sun & arcs</h1><p>A layered openwork study. Change the rhythm, then generate a new solid.</p></header><section className="sun-layout"><aside><div className="sun-presets">{Object.entries(presets).map(([name, value]) => <button disabled={busy} key={name} onClick={() => { setParams(value); setStatus('Parameters changed — generate to preview'); }}>{name}</button>)}</div>{Object.entries(limits).map(([key, [min, max, step]]) => <label key={key}>{key} <output>{params[key]}{['stroke','spacing','depth'].includes(key) ? ' mm' : ''}</output><input disabled={busy} aria-label={key} type="range" min={min} max={max} step={step} value={params[key]} onChange={e => { setParams({ ...params, [key]: Number(e.target.value) }); setStatus('Parameters changed — generate to preview'); }} /></label>)}<button disabled={busy} onClick={() => generate()}>Generate preview</button><button disabled={busy} onClick={() => generate(true)}>Export current parameters · STL</button><button disabled={busy} onClick={() => { setParams(defaults); setStatus('Defaults restored — generate to preview'); }}>Reset defaults</button><p role="status">{status}</p><p className="sun-note">30 mm diameter · 0.65 mm rim. Prototype only: no bail, fillets, casting allowance or minimum-feature certification. Dense settings can close gaps; disconnected islands must be checked before fabrication. Export uses current controls.</p></aside><div><div ref={container} className="sun-view" aria-label="Interactive gold pendant preview" /><p>Drag to orbit · scroll to zoom</p></div></section></main>;
}
