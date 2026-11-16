'use client';

import { useState, type CSSProperties } from 'react';
import { LogoMark } from '@/components/Logo';

// Bodoni Moda and five high-contrast faces like it. Each shows three weights;
// the sliders apply to every card at once. Font files load in page.tsx and
// arrive here as CSS variables.
type Face = {
  n: string;
  face: string;
  family: string;
  weights: [number, number, number];
  size: number;
  opsz?: [number, number]; // optical-size range the Contrast slider moves through
  kind: string;
  nNote: string;
  nStroke: number; // em of stroke the N fix adds; tuned per face so the N matches its neighbors
  note: string;
  pick?: boolean;
};

const FACES: Face[] = [
  { n: '1', face: 'Bodoni Moda', nStroke: 0.03, family: 'var(--f-bodoni)', weights: [400, 500, 700], size: 18, opsz: [6, 96], kind: 'Your favorite', nNote: 'N verticals are hairlines, much lighter than the T, L and I.', note: 'Lowering Contrast (a smaller optical size) thickens the hairlines and steadies the N.' },
  { n: '2', face: 'Noto Serif Display', nStroke: 0.01, family: 'var(--f-notodisplay)', weights: [200, 300, 500], size: 19, kind: 'Fine Didone, light weights', pick: true, nNote: 'Same Didone N, but every stroke is finer, so it sits close to its neighbors.', note: 'The airiest of the six: long hairlines and lots of light between strokes, closest to your light-and-shadow feeling.' },
  { n: '3', face: 'Playfair', nStroke: 0.028, family: 'var(--f-playfair)', weights: [300, 400, 600], size: 18, opsz: [12, 600], kind: 'Extreme-contrast display', nNote: 'At full contrast the N is as thin as Bodoni’s; lower Contrast fixes it.', note: 'The newer Playfair with an optical-size range up to poster size. Very dramatic and sharp.' },
  { n: '4', face: 'Playfair Display', nStroke: 0.018, family: 'var(--f-playfairdisplay)', weights: [400, 500, 700], size: 18, kind: 'Transitional high contrast', nNote: 'Thin N verticals, but sturdier than Bodoni’s, so the gap is smaller.', note: 'Rounder and warmer than Bodoni; very familiar from editorial sites.' },
  { n: '5', face: 'Libre Bodoni', nStroke: 0.01, family: 'var(--f-librebodoni)', weights: [400, 500, 700], size: 17, kind: 'Bodoni cut for smaller sizes', nNote: 'Thicker hairlines, so the N holds up well.', note: 'Same skeleton as Bodoni Moda with less contrast. Sturdier and darker, less spacey.' },
  { n: '6', face: 'Newsreader Display', nStroke: 0.006, family: 'var(--f-newsreader)', weights: [200, 300, 500], size: 19, opsz: [6, 72], kind: 'Moderate contrast', nNote: 'The most balanced N of the six.', note: 'Softer contrast and gentle wedge serifs. Calm and readable, the least dramatic.' },
];

function Word({ fixN }: { fixN: boolean }) {
  return (
    <span className="wm-text">
      CO<span className={fixN ? 'lab-n is-fixed' : 'lab-n'}>N</span>STELIER
    </span>
  );
}

function Lockup({ fixN }: { fixN: boolean }) {
  return (
    <span className="wm-mark">
      <LogoMark className="wm-star" />
      <Word fixN={fixN} />
    </span>
  );
}

function Header({ theme, fixN }: { theme: 'paper' | 'night'; fixN: boolean }) {
  return (
    <div className={`wm-header wm-${theme}`}>
      <Lockup fixN={fixN} />
      <span className="wm-links"><span>Skies</span><span>Process</span><span>Reading</span></span>
      <span className="wm-cta">Design yours</span>
    </div>
  );
}

export default function BodoniLab() {
  const [track, setTrack] = useState(0.18);
  const [contrast, setContrast] = useState(15);
  const [fixN, setFixN] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});

  return (
    <section className="wm-section lab">
      <p className="eyebrow">Bodoni Moda and five like it</p>
      <div className="lab-controls" role="group" aria-label="Wordmark controls">
        <label className="lab-control">
          <span>Letter spacing <b>{track.toFixed(2)}em</b></span>
          <input type="range" min={0.06} max={0.5} step={0.01} value={track} onChange={(e) => setTrack(Number(e.target.value))} />
        </label>
        <label className="lab-control">
          <span>Contrast <b>{contrast}%</b></span>
          <input type="range" min={0} max={100} step={1} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
          <small>Moves Bodoni Moda, Playfair and Newsreader between their text and display cuts</small>
        </label>
        <label className="lab-check">
          <input type="checkbox" checked={fixN} onChange={(e) => setFixN(e.target.checked)} />
          <span>Thicken the N’s hairlines</span>
        </label>
      </div>

      <ol className="wm-list">
        {FACES.map((f) => {
          const wi = picked[f.n] ?? 1;
          const opsz = f.opsz ? f.opsz[0] + ((f.opsz[1] - f.opsz[0]) * contrast) / 100 : undefined;
          const base = {
            '--wm-family': f.family,
            '--wm-size': `${f.size}px`,
            '--wm-track': `${track}em`,
            '--wm-nudge': '0.02em',
            '--wm-nstroke': `${f.nStroke}em`,
            '--wm-fvs': opsz ? `'opsz' ${opsz.toFixed(0)}` : 'normal',
          } as CSSProperties;
          const at = (w: number) => ({ ...base, '--wm-weight': w }) as CSSProperties;
          return (
            <li key={f.n} className={`wm-card${f.pick ? ' is-pick' : ''}`} style={at(f.weights[wi])}>
              <div className="wm-card-head">
                <span className="wm-n">{f.n}</span>
                <h2 className="wm-face">{f.face}</h2>
                <span className="wm-spec">{f.kind}</span>
                {f.pick && <span className="wm-pick">My pick</span>}
              </div>
              <Header theme="paper" fixN={fixN} />
              <Header theme="night" fixN={fixN} />
              <div className="lab-weights" role="radiogroup" aria-label={`${f.face} weight`}>
                {f.weights.map((w, i) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={i === wi}
                    className={`lab-weight${i === wi ? ' is-on' : ''}`}
                    style={at(w)}
                    onClick={() => setPicked((p) => ({ ...p, [f.n]: i }))}
                  >
                    <span className="lab-weight-label">{w}</span>
                    <span className="lab-weight-paper"><Lockup fixN={fixN} /></span>
                    <span className="lab-weight-night"><Lockup fixN={fixN} /></span>
                  </button>
                ))}
              </div>
              <div className="wm-specimen">
                <span className="wm-big"><Word fixN={fixN} /></span>
              </div>
              <p className="wm-note"><b>The N:</b> {f.nNote} {f.note}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
