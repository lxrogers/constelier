// Adaptive Liquid field vs exact: contour must match, and timing.
import { contours } from 'd3-contour';
import { chordsFor } from '../organic-compare/charts.mjs';
import { liquidField, LIQUID_DEFAULTS, buildLiquidOutline } from '../../modules/organic/outline-liquid.js';
const N = +(process.argv[2] || 40);
let worst = 0, signDiff = 0, tA = 0, tE = 0, lipMax = 0, outDiff = 0;
for (let n = 0; n < N; n++) {
  const day = new Date(Date.UTC(1950, 0, 1) + n * 86400000 * 523.7);
  const ch = chordsFor({ year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, date: day.getUTCDate(), hour: (n * 7) % 24, minute: 30, lat: 40.71, lon: -74 });
  if (!ch.length) continue;
  for (const blend of [2, 11, 24]) {
    const o = { ...LIQUID_DEFAULTS, blend };
    let t = performance.now();
    const E = liquidField(ch, 100, { ...o, exactField: true }); tE += performance.now() - t;
    t = performance.now();
    const A = liquidField(ch, 100, o); tA += performance.now() - t;
    for (let i = 0; i < E.field.length; i++) {
      const e = E.field[i], a = A.field[i];
      if ((e >= 0) !== (a >= 0)) signDiff++;
      // values adjacent to a sign change must be exact
    }
    const nx = E.nx;
    for (let j = 0; j < nx; j++) for (let i = 0; i + 1 < nx; i++) {
      const e0 = E.field[j * nx + i], e1 = E.field[j * nx + i + 1];
      lipMax = Math.max(lipMax, Math.abs(e1 - e0) / E.h);
      if ((e0 >= 0) !== (e1 >= 0)) worst = Math.max(worst, Math.abs(A.field[j * nx + i] - e0), Math.abs(A.field[j * nx + i + 1] - e1));
    }
    const oa = JSON.stringify(buildLiquidOutline(ch, 100, 8, { blend }));
    const oe = JSON.stringify(buildLiquidOutline(ch, 100, 8, { blend, exactField: true }));
    if (oa !== oe) outDiff++;
  }
}
console.log({ signDiff, worstAtContour: worst, lipMax: lipMax.toFixed(3), outlineDiffs: outDiff, exactMs: (tE / N / 3).toFixed(0), adaptiveMs: (tA / N / 3).toFixed(0) });
