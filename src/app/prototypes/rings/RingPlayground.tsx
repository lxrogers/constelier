'use client';
import { useEffect, useState } from 'react';
import { WAVE_CONTROLS, WAVE_DEFAULTS, WAVE_PRESETS, normalizeWave, serializeWave, parseWave } from '@/modules/rings/wave.mjs';
import RingCanvas from './RingCanvas';
import RingControls from './RingControls';
import { useRingMesh, exportRing } from './useRingMesh';
import './rings.css';

function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RingPlayground() {
  const [params, setParams] = useState({ ...WAVE_DEFAULTS });
  const [preset, setPreset] = useState('tide');
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [material, setMaterial] = useState<'gold' | 'neutral'>('gold');
  const [view, setView] = useState({ direction: 'hero', serial: 0 });
  const [lighting, setLighting] = useState('Lighting the studio…');
  const [viewerError, setViewerError] = useState('');
  const [exporting, setExporting] = useState(false), [notice, setNotice] = useState('');
  const { result, status, error } = useRingMesh(params);
  useEffect(() => {
    if (location.hash.startsWith('#ring=')) {
      try { const parsed = parseWave(decodeURIComponent(location.hash.slice(6))); setParams(parsed.params); setAdjustments(parsed.adjustments); setPreset('custom'); }
      catch { setNotice('This design link could not be read. Showing Tide.'); }
    }
  }, []);
  function update(key, value) {
    const next = normalizeWave({ ...params, [key]: value });
    setParams(next.params); setAdjustments(next.adjustments); setPreset('custom'); setNotice('');
  }
  function choose(p) { setParams({ ...p.params }); setPreset(p.id); setAdjustments([]); setNotice(''); }
  async function saveLink() {
    const url = new URL(location.href); url.hash = 'ring=' + encodeURIComponent(serializeWave(params));
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url.href); setNotice('Design link copied.'); }
    catch { setNotice('Design saved in the address bar. Copy the URL to keep it.'); }
  }
  async function exportSTL() {
    setExporting(true); setNotice('Checking a detailed mesh for export…');
    try {
      const data = await exportRing({ ...params });
      download(data.stl, 'constelier-wave-mm.stl', 'model/stl');
      setNotice(`STL saved in mm · ${data.report.triangleCount.toLocaleString()} triangles. Parameters captured when you clicked.`);
    } catch (e) { setNotice(e.message); }
    finally { setExporting(false); }
  }
  const upToDate = result && JSON.stringify(result.mesh.params) === JSON.stringify(params);
  return <main className="ring-playground">
    <header className="ring-heading"><div><p className="ring-eyebrow">FORM STUDIES <span>/</span> 01</p><h1>Continuous wave</h1></div><p className="ring-intro">A rhythm, made tangible.<br />Move a dial. Find your form.</p></header>
    <div className="ring-layout">
      <section className="ring-stage" aria-label="Ring studio">
        <div className="ring-stage-top"><span className="ring-study">{preset === 'custom' ? 'Your study' : WAVE_PRESETS.find(p => p.id === preset)?.name} <i> / wave ring</i></span><div className="ring-materials" aria-label="Material"><button aria-pressed={material === 'gold'} onClick={() => setMaterial('gold')}><b className="gold-swatch" />Gold</button><button aria-pressed={material === 'neutral'} onClick={() => setMaterial('neutral')}><b className="clay-swatch" />Clay</button></div></div>
        <RingCanvas result={result} material={material} view={view} onLighting={setLighting} onError={setViewerError} />
        {(!result || viewerError) && <div className="ring-loading" role="status">{viewerError ? `Studio unavailable: ${viewerError}` : 'Preparing your ring…'}</div>}
        <div className="ring-stage-bottom"><span className="ring-orbit-hint">Drag to turn <b>·</b> Scroll to zoom</span><div className="ring-views" aria-label="Camera view">{[['hero', 'Perspective'], ['top', 'Top'], ['side', 'Profile']].map(([direction, label]) => <button key={direction} onClick={() => setView({ direction, serial: view.serial + 1 })}>{label}</button>)}</div></div>
        <div className="ring-presets" aria-label="Starting points">{WAVE_PRESETS.map((p, i) => <button key={p.id} className={preset === p.id ? 'selected' : ''} aria-pressed={preset === p.id} onClick={() => choose(p)}><span className="ring-preset-number">0{i + 1}</span><span><strong>{p.name}</strong><small>{p.note}</small></span><span className="ring-preset-arrow">↗</span></button>)}</div>
      </section>
      <aside className="ring-sidebar">
        <div className="ring-sidebar-title"><h2>Shape your ring</h2><button className="ring-reset" onClick={() => choose(WAVE_PRESETS[0])}>Reset</button></div>
        <RingControls params={params} controls={[...WAVE_CONTROLS.filter(c => c.group === 'Wave'), ...WAVE_CONTROLS.filter(c => c.group !== 'Wave')]} onChange={update} />
        {adjustments.length > 0 && <p className="ring-adjustment" role="status">{adjustments.join(' ')}</p>}
        <div className="ring-fit-note"><span>↔</span><p>Your fit stays fixed.<small>The waves move around a {params.innerDiameter.toFixed(1)} mm opening.</small></p></div>
        <div className="ring-actions"><button className="ring-export" disabled={exporting || !result || !!error} onClick={exportSTL}>{exporting ? 'Preparing STL…' : 'Export ring'}<span>{exporting ? '…' : '↓ STL'}</span></button><button className="ring-save" onClick={saveLink}>Copy design link <span>↗</span></button></div>
        <p className="ring-notice" role="status" aria-live="polite">{error || notice}</p>
        <details className="ring-details"><summary><span className={error ? 'ring-dot error' : 'ring-dot'} />{error ? 'Check shape' : upToDate && status === 'Ready' ? 'Mesh checked' : status}<span>Details</span></summary><dl><dt>Studio</dt><dd>{lighting}</dd><dt>Mesh</dt><dd>{result?.report.triangleCount.toLocaleString() || '—'} triangles</dd><dt>Build + checks</dt><dd>{result ? `${result.timing.totalMs.toFixed(1)} ms` : '—'}</dd><dt>Closure</dt><dd>{result?.report.valid ? 'One closed surface' : '—'}</dd><dt>Intersections</dt><dd>{result?.quality === 'settled' ? 'None detected' : 'Checking on release'}</dd><dt>Radial wall</dt><dd>≥ {params.thickness.toFixed(2)} mm</dd></dl><p>Dimensions are in millimetres. Radial wall is measured within each section. This is a geometry study; a jeweller should review fit, local wall thickness and finishing before fabrication.</p><button onClick={() => download(serializeWave(params), 'constelier-wave.json', 'application/json')}>Save parameters · JSON</button></details>
      </aside>
    </div>
    <footer className="ring-footer"><span>CONSTELIER <i> / Ring studio</i></span><span>A study in shape, light & proportion</span></footer>
  </main>;
}
