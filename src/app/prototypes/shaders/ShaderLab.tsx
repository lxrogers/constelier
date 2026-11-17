'use client';
import { useEffect, useMemo, useState } from 'react';
import { LAB_SAMPLES } from '@/config/lab-samples';
import BezierEditor from './BezierEditor';
import type { Curve, ExitKind, RevealKind, StageLook, StageScene } from './shader-stage-engine';
import { useShaderStage } from './useShaderStage';
import './shaders.css';

const SCENES: { id: StageScene; label: string }[] = [{ id: 'stone', label: 'On stone' }, { id: 'wall', label: 'Against a wall' }];
const LOOKS: { id: StageLook; label: string }[] = [{ id: 'traced', label: 'New shader' }, { id: 'stock', label: 'Stock material' }];

const REVEALS: { id: RevealKind; label: string; note: string }[] = [
  { id: 'fade', label: 'Fade', note: 'Today’s behaviour: the finished pendant fades in.' },
  { id: 'glint', label: 'Glint', note: 'A quick fade while a band of light runs across the edges.' },
  { id: 'outline', label: 'Outline first', note: 'Thin gold wires trace every edge, then widen until the metal is solid.' },
  { id: 'rise', label: 'Rise', note: 'The flat outline gains thickness, overshoots a touch and settles.' },
  { id: 'liquid', label: 'Liquid', note: 'Swells up as rounded beads of metal that flatten into the finished piece.' },
  { id: 'pour', label: 'Pour', note: 'A rounded, wavy front of gold runs down from the bail.' },
  { id: 'flow', label: 'Flow in', note: 'Gold runs in from the rim toward the middle along every bar, behind a wavy front.' },
];

const EXITS: { id: ExitKind; label: string; note: string }[] = [
  { id: 'cut', label: 'Cut', note: 'The inside is simply gone on the next frame.' },
  { id: 'fade', label: 'Fade', note: 'The inside fades out where it stands.' },
  { id: 'sink', label: 'Sink', note: 'The inside thins, pulls in from its edges and sinks away.' },
  { id: 'drain', label: 'Drain', note: 'Flow in, backwards: the gold runs back out to the rim.' },
];

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="sl-field">
      <span className="sl-label">{label}</span>
      <div className="sl-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
      </div>
    </div>
  );
}

export default function ShaderLab() {
  const [sampleId, setSampleId] = useState(LAB_SAMPLES[1].id);
  const [scene, setScene] = useState<StageScene>('wall');
  const [look, setLook] = useState<StageLook>('traced');
  const [trace, setTrace] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [card, setCard] = useState(true);
  const [bench, setBench] = useState('');
  const [reveal, setReveal] = useState<RevealKind>('flow');
  const [keepRim, setKeepRim] = useState(true);
  const [exit, setExit] = useState<ExitKind>('drain');
  const [exitMs, setExitMs] = useState(300);
  const [curve, setCurve] = useState<Curve>([0.25, 0.8, 0.39, 0.99]);
  const [ms, setMs] = useState(1400);
  const [loop, setLoop] = useState(true);
  const sample = LAB_SAMPLES.find((s) => s.id === sampleId) || LAB_SAMPLES[0];
  const options = useMemo(() => ({ scene, look, trace, shadows, card }), [scene, look, trace, shadows, card]);
  const { host, stats, error, benchmark, playReveal, setCurve: applyCurve } = useShaderStage(sample, options);
  const traced = look === 'traced';
  const ready = !!stats;
  useEffect(() => { if (ready) applyCurve(curve); }, [ready, curve]); // eslint-disable-line react-hooks/exhaustive-deps
  // Replay whenever the reveal, its length or the pendant changes.
  const play = () => playReveal({ kind: reveal, ms, loop, keepRim, exit, exitMs });
  useEffect(() => { if (ready && traced) play(); }, [ready, traced, reveal, ms, loop, keepRim, exit, exitMs, sampleId, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="sl">
      <div className="sl-stage" ref={host} />
      <aside className="sl-panel">
        <h1>Shader lab</h1>
        <p className="sl-lede">A real-time gold that borrows the tricks that make the Blender renders look real. Drag to orbit, scroll to zoom.</p>
        <Choice<StageScene> label="Scene" value={scene} options={SCENES} onChange={setScene} />
        <Choice<StageLook> label="Look" value={look} options={LOOKS} onChange={setLook} />
        {!traced && <p className="sl-note">Three.js’s standard metal with the settings today’s viewer uses, without its post-processing.</p>}
        <div className="sl-field">
          <span className="sl-label">Pendant</span>
          <select value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
            {LAB_SAMPLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <fieldset className="sl-reveal" disabled={!traced}>
          <legend className="sl-label">How the pendant arrives</legend>
          <div className="sl-grid" role="group" aria-label="Reveal">
            {REVEALS.map((r) => <button key={r.id} type="button" aria-pressed={r.id === reveal} onClick={() => setReveal(r.id)}>{r.label}</button>)}
          </div>
          <p className="sl-note">{REVEALS.find((r) => r.id === reveal).note}</p>
          <BezierEditor value={curve} onChange={setCurve} />
          <label className="sl-range">Length <input type="range" min={150} max={2500} step={10} value={ms} onChange={(e) => setMs(+e.target.value)} /> <output>{ms} ms</output></label>
          <div className="sl-row">
            <button type="button" className="sl-bench" onClick={play}>Play</button>
            <label><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Repeat</label>
            <label><input type="checkbox" checked={keepRim} onChange={(e) => setKeepRim(e.target.checked)} /> Rim stays</label>
          </div>
        </fieldset>
        <fieldset className="sl-reveal" disabled={!traced}>
          <legend className="sl-label">How the inside leaves</legend>
          <div className="sl-grid sl-grid-4" role="group" aria-label="Exit">
            {EXITS.map((x) => <button key={x.id} type="button" aria-pressed={x.id === exit} onClick={() => setExit(x.id)}>{x.label}</button>)}
          </div>
          <p className="sl-note sl-note-short">{EXITS.find((x) => x.id === exit).note}</p>
          <label className="sl-range">Length <input type="range" min={30} max={400} step={10} value={exitMs} disabled={exit === 'cut'} onChange={(e) => setExitMs(+e.target.value)} /> <output>{exit === 'cut' ? '0' : exitMs} ms</output></label>
        </fieldset>
        <fieldset className="sl-toggles" disabled={!traced}>
          <legend className="sl-label">What the new shader adds</legend>
          <label><input type="checkbox" checked={trace} onChange={(e) => setTrace(e.target.checked)} /> Traced reflections <small>bars and edges mirror each other and the surface</small></label>
          <label><input type="checkbox" checked={shadows} onChange={(e) => setShadows(e.target.checked)} /> Sun shadows <small>sharp at the metal, softer further away</small></label>
          <label><input type="checkbox" checked={card} onChange={(e) => setCard(e.target.checked)} /> Light card <small>a gradient across the flat face instead of one colour</small></label>
        </fieldset>
        <dl className="sl-stats">
          <dt>Frame rate</dt><dd>{stats ? `${stats.fps.toFixed(0)} fps` : '…'}</dd>
          <dt>Canvas</dt><dd>{stats ? `${stats.width} × ${stats.height}` : '…'}</dd>
          <dt>Triangles</dt><dd>{stats ? stats.triangles.toLocaleString() : '…'}</dd>
          <dt>Distance field</dt><dd>{stats ? `${stats.sdfMs.toFixed(0)} ms to build` : '…'}</dd>
        </dl>
        <button type="button" className="sl-bench" onClick={() => setBench(`${benchmark().toFixed(1)} ms per frame`)}>Measure frame cost</button>
        {bench && <p className="sl-note">{bench}, with the display’s refresh limit taken out.</p>}
        {error && <p className="sl-error">{error}</p>}
      </aside>
    </main>
  );
}
