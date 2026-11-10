import fs from 'fs';
import makerjs from 'makerjs';
import { chordsFor } from './charts.mjs';
import { buildPendantModel, serializeChainsFor3D } from '../../modules/pendant-geometry.js';
import { buildLiquidOutline } from '../../modules/organic/outline-liquid.js';
import { buildPebbleOutline } from '../../modules/organic/outline-pebble.js';
import { outlineDataToLoops, castabilityMetrics, outlineSVG, minCurvatureRadius } from '../../modules/organic/outline-common.js';

export const SAMPLES = {
  sparse:  { year: 1977, month: 10, date: 14, hour: 9, minute: 30, lat: 40.71, lon: -74.0 },
  medium:  { year: 1996, month: 10, date: 14, hour: 9, minute: 30, lat: 40.71, lon: -74.0 },
  dense:   { year: 1987, month: 2, date: 14, hour: 9, minute: 30, lat: 40.71, lon: -74.0 },
  extreme: { year: 1997, month: 2, date: 14, hour: 9, minute: 30, lat: 40.71, lon: -74.0 },
};
const R = 100, BORDER = 8;
export const ALGOS = {
  current: ch => serializeChainsFor3D(buildPendantModel(ch, 3, R, BORDER, 185, 5, 5), R, BORDER),
  liquid:  ch => buildLiquidOutline(ch, R, BORDER),
  pebble:  ch => buildPebbleOutline(ch, R, BORDER),
};
const only = process.argv[2];
const res = {};
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
for (const [name, d] of Object.entries(SAMPLES)) {
  const ch = chordsFor(d);
  res[name] = { chords: ch.length };
  for (const [alg, fn] of Object.entries(ALGOS)) {
    if (only && alg !== only && alg !== 'current') continue;
    const t0 = performance.now();
    const data = fn(ch);
    const ms = performance.now() - t0;
    const loops = outlineDataToLoops(data);
    const m = castabilityMetrics(loops, R, BORDER);
    let minR = Infinity;
    for (const c of data.voidChains) for (const l of c.links) {
      if (l.type === 'arc') minR = Math.min(minR, l.radius);
      if (l.type === 'line' || l.type === 'arc') continue;
    }
    for (const c of data.voidChains) if (c.links[0].type === 'bezier') minR = Math.min(minR, minCurvatureRadius(c.links.map(l => [l.p0, l.c1, l.c2, l.p3])));
    // Corners with no fillet at all count as radius 0.
    for (const c of data.voidChains) for (let i = 0; i < c.links.length; i++) {
      const a = c.links[i], b = c.links[(i + 1) % c.links.length];
      if (a.type === 'line' && b.type === 'line') minR = 0;
    }
    res[name][alg] = { minR: +minR.toFixed(2), ms: Math.round(ms), voids: m.voidCount, minWire: +m.minWire.toFixed(2), minVoid: Math.round(m.minVoid), segs: data.voidChains.reduce((a, c) => a + c.links.length, 0) };
    fs.writeFileSync(new URL(`./out/${name}-${alg}.json`, import.meta.url), JSON.stringify(data));
    fs.writeFileSync(new URL(`./out/${name}-${alg}.loops.json`, import.meta.url), JSON.stringify(loops));
    fs.writeFileSync(new URL(`./out/${name}-${alg}.svg`, import.meta.url), outlineSVG(loops, R, BORDER, { bg: '#fff' }));
  }
}
console.log(JSON.stringify(res, null, 1));
