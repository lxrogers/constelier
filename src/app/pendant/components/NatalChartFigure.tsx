import { useId } from 'react';
import type { NatalFigure, FigureAspect } from '@/lib/natal-figure';

// The natal chart as a flat drawing: zodiac ring, planets and the aspect
// lines the pendant is cut from. Plain SVG, sized to a 4:5 gallery slide.

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// U+FE0E keeps the glyphs as text rather than emoji.
const GLYPHS: Record<string, string> = {
  sun: '☉︎', moon: '☽︎', mercury: '☿︎', venus: '♀︎', mars: '♂︎',
  jupiter: '♃︎', saturn: '♄︎', uranus: '♅︎', neptune: '♆︎', pluto: '♇︎',
};
const LINE: Record<FigureAspect, { width: number; dash?: string }> = {
  opposition: { width: 2.2 },
  trine: { width: 1.8 },
  square: { width: 1.8 },
  sextile: { width: 1.4, dash: '7 6' },
  conjunction: { width: 1.8 },
};

const W = 800, H = 1000, CX = 400, CY = 452;
const R_OUT = 300, R_IN = 252, R_GLYPH = (R_OUT + R_IN) / 2;
// Sign names follow the ring. Their baseline sits further out on the lower
// half, where the letters stand with their feet away from the centre.
const LABEL_SIZE = 15, R_LABEL_TOP = R_OUT + 17, R_LABEL_LOW = R_LABEL_TOP + LABEL_SIZE * 0.72;
const INK = '#2c2a26', RING = '#6b6358', SOFT = '#8f877a';

const norm = (d: number) => ((d % 360) + 360) % 360;

export default function NatalChartFigure({ figure, caption }: { figure: NatalFigure; caption: string }) {
  // The ascendant sits at nine o'clock and the signs run anticlockwise,
  // the same way the configurator draws them.
  const angle = (deg: number) => ((180 - deg + figure.ascDeg) * Math.PI) / 180;
  const at = (deg: number, r: number) => ({ x: CX + r * Math.cos(angle(deg)), y: CY + r * Math.sin(angle(deg)) });
  const shown = spread(figure.planets, 9);
  const uid = useId();

  return (
    <svg className="pdp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Natal chart: ${caption}`}>
      <rect width={W} height={H} fill="#f5f0e6" />

      <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke={RING} strokeWidth="1.6" />
      <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke={RING} strokeWidth="1.2" />

      {SIGNS.map((name, i) => {
        const a = at(i * 30, R_OUT), b = at(i * 30, R_IN);
        // An arc across the sign for its name to run along, drawn left to
        // right as it is read: clockwise over the top, the other way below.
        const lower = Math.sin(angle(i * 30 + 15)) > 0;
        const r = lower ? R_LABEL_LOW : R_LABEL_TOP;
        const from = at(lower ? i * 30 : i * 30 + 30, r), to = at(lower ? i * 30 + 30 : i * 30, r);
        const arcId = `${uid}-sign-${i}`;
        return (
          <g key={name}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={RING} strokeWidth="1.2" />
            <path id={arcId} d={`M${from.x} ${from.y}A${r} ${r} 0 0 ${lower ? 0 : 1} ${to.x} ${to.y}`} fill="none" />
            <text fontSize={LABEL_SIZE} letterSpacing="2.4" fill={SOFT} textAnchor="middle">
              <textPath href={`#${arcId}`} startOffset="50%">{name.toUpperCase()}</textPath>
            </text>
          </g>
        );
      })}

      {figure.lines.map((l, i) => {
        const p = at(l.deg1, R_IN), q = at(l.deg2, R_IN);
        return (
          <line
            key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke={INK} strokeOpacity="0.78" strokeWidth={LINE[l.type].width}
            strokeDasharray={LINE[l.type].dash} strokeLinecap="round"
          />
        );
      })}

      {shown.map((p) => {
        const t1 = at(p.deg, R_IN + 7), t2 = at(p.deg, R_IN - 7);
        const g = at(p.shownDeg, R_GLYPH);
        return (
          <g key={p.key}>
            <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke={INK} strokeWidth="1.6" />
            <circle cx={at(p.deg, R_IN).x} cy={at(p.deg, R_IN).y} r="3" fill={INK} />
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={p.key === 'sun' ? 30 : 25} fill={INK}>
              {GLYPHS[p.key] ?? p.key[0].toUpperCase()}
            </text>
          </g>
        );
      })}

      <text x={CX} y={878} textAnchor="middle" fontFamily="var(--serif)" fontSize="34" fill={INK}>Your natal chart</text>
      <text x={CX} y={918} textAnchor="middle" fontSize="17" fill={SOFT}>{caption}</text>
    </svg>
  );
}

// Nudges glyphs apart so planets close together don't overlap. Each keeps
// its true position for the tick; only the glyph moves.
function spread(planets: { key: string; deg: number }[], minGap: number) {
  const items = planets.map((p) => ({ ...p, shownDeg: norm(p.deg) })).sort((a, b) => a.shownDeg - b.shownDeg);
  const n = items.length;
  if (n < 2) return items;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const a = items[i], b = items[(i + 1) % n];
      const gap = norm(b.shownDeg - a.shownDeg);
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        a.shownDeg = norm(a.shownDeg - push);
        b.shownDeg = norm(b.shownDeg + push);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return items;
}
