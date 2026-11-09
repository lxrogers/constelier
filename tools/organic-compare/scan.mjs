import { chordsFor } from './charts.mjs';
import { buildPendantModel, serializeChainsFor3D } from '../../modules/pendant-geometry.js';
import { computeVoids } from '../../modules/organic/outline-voids.js';
import { outlineDataToLoops, signedArea } from '../../modules/organic/outline-common.js';
let n = 0, bad = [];
for (let y = 1960; y <= 2010; y += 1) for (const mo of [1, 4, 7, 10]) {
  const d = { year: y, month: mo, date: 14, hour: 9, minute: 30, lat: 40.71, lon: -74.0 };
  const ch = chordsFor(d);
  if (!ch.length) continue;
  n++;
  const cur = outlineDataToLoops(serializeChainsFor3D(buildPendantModel(ch, 3, 100, 8, 185, 5, 5), 100, 8));
  const ref = computeVoids(ch, 100, () => 3, {});
  const a = cur.reduce((s, l) => s + Math.abs(signedArea(l)), 0);
  const b = ref.reduce((s, l) => s + Math.abs(signedArea(l)), 0);
  if (a < 0.8 * b) bad.push(`${y}-${mo} chords ${ch.length} voidArea ${Math.round(a)} vs ${Math.round(b)}`);
}
console.log('charts', n, 'with missing voids', bad.length); console.log(bad.slice(0, 8).join('\n'));
