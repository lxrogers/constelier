import { chordsFor } from '../organic-compare/charts.mjs';
import { buildOrganicOutline } from '../../modules/organic/index.js';
import { buildPreviewMesh } from '../../modules/fast-pendant-mesh.js';
const charts = { sparse: '1977-10-14', medium: '1996-10-14', dense: '1987-02-14', busiest: '1997-02-14' };
const opt = JSON.parse(process.argv[2] || '{}');
for (const [name, day] of Object.entries(charts)) {
  const [y, m, d] = day.split('-').map(Number);
  const ch = chordsFor({ year: y, month: m, date: d, hour: 9, minute: 30, lat: 40.71, lon: -74.0 });
  for (const style of ['liquid', 'pebble']) {
    buildOrganicOutline(style, ch, 100, 8, { midHalfWidth: 3, minArea: 185, minAngle: 5, ...opt });
    const t0 = performance.now();
    const data = buildOrganicOutline(style, ch, 100, 8, { midHalfWidth: 3, minArea: 185, minAngle: 5, ...opt });
    const t1 = performance.now();
    const mesh = buildPreviewMesh(data, { thickness: 5, filletR: 2, minFeature: 6 });
    const t2 = performance.now();
    console.log(name, ch.length, style, 'outline', (t1 - t0).toFixed(0), 'mesh', (t2 - t1).toFixed(0), 'voids', data.voidChains.length, 'tris', mesh.triangles.length / 3);
  }
}
