// Debug: Liquid outline at each stage (raw contour, smoothed, tip-limited, fitted).
import fs from 'fs';
import { contours } from 'd3-contour';
import { chordsFor } from './charts.mjs';
import { liquidField, LIQUID_DEFAULTS } from '../../modules/organic/outline-liquid.js';
import { ensureCCW, signedArea, resampleLoop, taubinSmooth, limitTipRadius, fitC2Loop, sampleBezierLoop } from '../../modules/organic/outline-common.js';
const [day, outPath, extra] = process.argv.slice(2);
const [y, m, d] = day.split('-').map(Number);
const ch = chordsFor({ year: y, month: m, date: d, hour: +(process.env.HOUR||9), minute: 30, lat: 40.71, lon: -74.0 });
const o = { ...LIQUID_DEFAULTS, ...(extra ? JSON.parse(extra) : {}) };
const { field, nx, ny, h, ext } = liquidField(ch, 100, o);
const mp = contours().size([nx, ny]).smooth(true).thresholds([0])(field)[0];
const st = { raw: [], smooth: [], tip: [], fit: [] };
for (const poly of mp.coordinates) {
  const ring = ensureCCW(poly[0].slice(0, -1).map(([gx, gy]) => [-ext + (gx - 0.5) * h, -ext + (gy - 0.5) * h]));
  if (Math.abs(signedArea(ring)) < o.minArea) continue;
  st.raw.push(ring);
  const s = taubinSmooth(resampleLoop(ring, 0.4), 3); st.smooth.push(s);
  const t = limitTipRadius(s, o.minTipRadius * 1.25, 0.3); st.tip.push(t);
  st.fit.push(sampleBezierLoop(fitC2Loop(t), 24));
}
const ang = [...new Set(ch.flatMap(c => [c.a1, c.a2]).map(a => a.toFixed(4)))].map(Number);
const J = ang.map(a => [100 * Math.cos(a), 100 * Math.sin(a)]);
for (const k of Object.keys(st)) fs.writeFileSync(outPath + '-' + k + '.json', JSON.stringify({ loops: st[k], junctions: J }));
