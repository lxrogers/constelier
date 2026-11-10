import { contours } from 'd3-contour';
import { chordsFor } from '../organic-compare/charts.mjs';
import { liquidField, LIQUID_DEFAULTS } from '../../modules/organic/outline-liquid.js';
import { ensureCCW, signedArea, resampleLoop, taubinSmooth, limitTipRadius, fitC2Loop } from '../../modules/organic/outline-common.js';
const day = process.argv[2] || '1997-02-14';
const [y, m, d] = day.split('-').map(Number);
const ch = chordsFor({ year: y, month: m, date: d, hour: 9, minute: 30, lat: 40.71, lon: -74.0 });
const o = { ...LIQUID_DEFAULTS, ...JSON.parse(process.argv[3] || '{}') };
for (let rep = 0; rep < 2; rep++) {
  let t = performance.now(); const T = {}; const lap = k => { const n = performance.now(); T[k] = (T[k] || 0) + n - t; t = n; };
  const { field, nx, ny, h, ext } = liquidField(ch, 100, o); lap('field');
  const mp = contours().size([nx, ny]).smooth(true).thresholds([0])(field)[0]; lap('contour');
  for (const poly of mp.coordinates) {
    const ring = ensureCCW(poly[0].slice(0, -1).map(([gx, gy]) => [-ext + (gx - 0.5) * h, -ext + (gy - 0.5) * h]));
    if (Math.abs(signedArea(ring)) < o.minArea) continue;
    const s = taubinSmooth(resampleLoop(ring, 0.4), 3); lap('smooth');
    const tt = limitTipRadius(s, o.minTipRadius * 1.25, 0.3); lap('tip');
    fitC2Loop(tt); lap('fit');
  }
  if (rep) console.log(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.toFixed(0)])));
}
