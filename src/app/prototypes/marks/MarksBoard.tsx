'use client';

import type { ComponentType } from 'react';
import { AspectDisc, CastC, ConstellationC, OneAspect, OrbitC, PendantMark, SextileStar, StarMark } from './marks';

type Mark = { n: string; name: string; Icon: ComponentType<{ size?: number }>; note: string; pick?: boolean };

const MARKS: Mark[] = [
  { n: '01', name: 'Aspect disc', Icon: AspectDisc, pick: true, note: 'The chart itself: a ring and three chords. Thin line art like Co–Star, and it says what the product is. Drops to two heavier chords at favicon size.' },
  { n: '02', name: 'Pendant', Icon: PendantMark, note: 'The cast piece in silhouette: a solid disc with the voids the chords leave. The boldest favicon here, and it reads as jewelry.' },
  { n: '03', name: 'Star (current)', Icon: StarMark, note: 'The eight-point star already in the header, kept as the baseline. Handsome, but any brand could own it.' },
  { n: '04', name: 'Orbit C', Icon: OrbitC, note: 'A C drawn as an orbit with a planet sitting in the opening. The direct replacement for the serif C.' },
  { n: '05', name: 'Cast C', Icon: CastC, note: 'A heavy gold ring with one chord sliced out, so the cut makes the C. Most like a hallmark stamp.' },
  { n: '06', name: 'One aspect', Icon: OneAspect, note: 'Two planets and the line between them. The smallest true idea of the product; very clean at 16 px.' },
  { n: '07', name: 'Constellation C', Icon: ConstellationC, note: 'Stars along a C joined like a constellation. Charming and literal; the one hand-made touch, but busy when small.' },
  { n: '08', name: 'Sextile star', Icon: SextileStar, note: 'The six-point figure that trines and sextiles draw inside the circle. Mystical, but it edges toward occult-shop.' },
];

function Lockup({ Icon, size = 22 }: { Icon: Mark['Icon']; size?: number }) {
  return (
    <span className="mk-lockup">
      <Icon size={size} />
      <span className="mk-word">CONSTELIER</span>
    </span>
  );
}

export default function MarksBoard() {
  return (
    <main className="theme-root theme-paper mk">
      <header className="mk-head">
        <p className="eyebrow">Prototype · Marks</p>
        <h1 className="mk-h1">Marks for CONSTELIER</h1>
        <p className="mk-lede">Eight options to replace the serif C, each shown large, at favicon sizes (32 and 16 px), and beside the caps wordmark, on paper and on night.</p>
      </header>

      <section className="mk-word-row">
        <p className="eyebrow">Wordmark only, with the O as the chart</p>
        <div className="mk-word-pair">
          <span className="mk-oswap">C<span className="mk-oswap-o"><AspectDisc size={64} /></span>NSTELIER</span>
          <span className="mk-oswap mk-night-text">C<span className="mk-oswap-o"><AspectDisc size={64} /></span>NSTELIER</span>
        </div>
        <p className="mk-note">A ninth route: no separate mark at all, the O in the wordmark becomes the aspect disc. Works on packaging and the site header, but needs a separate favicon (01 or 02).</p>
      </section>

      <ol className="mk-grid">
        {MARKS.map(({ n, name, Icon, note, pick }) => (
          <li key={n} className={`mk-card${pick ? ' is-pick' : ''}`}>
            <div className="mk-card-head">
              <span className="mk-n">{n}</span>
              <h2 className="mk-name">{name}</h2>
              {pick && <span className="mk-pick">My pick</span>}
            </div>
            <div className="mk-tiles">
              <div className="mk-tile mk-paper">
                <span className="mk-big"><Icon size={112} /></span>
                <span className="mk-small"><Icon size={32} /><Icon size={16} /></span>
              </div>
              <div className="mk-tile mk-night">
                <span className="mk-big"><Icon size={112} /></span>
                <span className="mk-small"><Icon size={32} /><Icon size={16} /></span>
              </div>
            </div>
            <div className="mk-lockups">
              <span className="mk-paper-lock"><Lockup Icon={Icon} /></span>
              <span className="mk-night-lock"><Lockup Icon={Icon} /></span>
            </div>
            <p className="mk-note">{note}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
