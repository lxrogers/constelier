// Every outline style (and Liquid across the slider range) on many charts:
// export mesh must be watertight, genus = voids, no self-intersections,
// no NaN in the preview mesh. Also times the draft (drag) build.
import { chordsFor } from '../organic-compare/charts.mjs';
import { buildPreview, buildExportMesh, outlineData, LIQUIDITY } from '../../modules/pendant-build.js';
import { weld, topology, selfIntersections } from '../mesh-export/mesh-check.mjs';
const N = +(process.argv[2] || 30), SELFX = process.argv[3] !== 'noselfx';
const cases = [['current'], ['pebble'], ...[LIQUIDITY.min, 6, 11, 20, LIQUIDITY.max].map(l => ['liquid', l])];
const stat = {};
let charts = 0;
for (let n = 0; n < N; n++) {
  const d = new Date(Date.UTC(1940, 0, 1) + n * 86400000 * 977.3);
  const ch = chordsFor({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate(), hour: (n * 5) % 24, minute: (n * 13) % 60, lat: 40.71, lon: -74 });
  if (!ch.length) continue;
  charts++;
  for (const [style, liquidity] of cases) {
    const key = style + (liquidity !== undefined ? ':' + liquidity : '');
    const s = stat[key] ||= { fail: 0, notes: [], ms: 0, draftMs: 0, maxMs: 0 };
    const p = { style, chords: ch, liquidity };
    try {
      let t = performance.now();
      const { mesh } = buildPreview(p);
      const ms = performance.now() - t; s.ms += ms; s.maxMs = Math.max(s.maxMs, ms);
      if (style === 'liquid') { t = performance.now(); buildPreview({ ...p, draft: true }); s.draftMs += performance.now() - t; }
      if (mesh.vertices.some(Number.isNaN) || mesh.normals.some(Number.isNaN)) throw new Error('NaN in preview mesh');
      const voids = outlineData(p).voidChains.length;
      const ex = buildExportMesh(p);
      const top = topology(weld(ex.vertices, ex.triangles));
      if (!top.watertight) throw new Error('not watertight ' + JSON.stringify(top));
      if (Math.round(top.genus) !== voids) throw new Error(`genus ${top.genus} != voids ${voids}`);
      if (SELFX) { const sx = selfIntersections(weld(ex.vertices, ex.triangles)); if (sx.hits) throw new Error('self-intersections ' + sx.hits); }
    } catch (e) { s.fail++; if (s.notes.length < 3) s.notes.push(`${d.toISOString().slice(0, 10)} ${e.message.slice(0, 120)}`); }
  }
}
console.log('charts', charts);
for (const [k, s] of Object.entries(stat)) console.log(k.padEnd(12), 'fail', s.fail, 'avg', (s.ms / charts).toFixed(0), 'ms max', s.maxMs.toFixed(0), s.draftMs ? 'draft avg ' + (s.draftMs / charts).toFixed(0) : '', s.notes.join(' | '));
