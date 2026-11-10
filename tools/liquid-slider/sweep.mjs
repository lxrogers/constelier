// Liquid outline across values of one option, as loops JSON + timings.
import fs from 'fs';
import { chordsFor } from '../organic-compare/charts.mjs';
import { buildLiquidOutline } from '../../modules/organic/outline-liquid.js';
import { outlineDataToLoops, castabilityMetrics } from '../../modules/organic/outline-common.js';
const [out, key, extraJson, ...vals] = process.argv.slice(2);
const extra = JSON.parse(extraJson || '{}');
const res = {};
for (const day of ['1987-02-14', '1977-10-14', '1997-02-14', '1996-10-14']) {
  const [y, m, d] = day.split('-').map(Number);
  const ch = chordsFor({ year: y, month: m, date: d, hour: 9, minute: 30, lat: 40.71, lon: -74.0 });
  res[day] = {};
  for (const v of vals) {
    const t = performance.now();
    const data = buildLiquidOutline(ch, 100, 8, { midHalfWidth: 3, ...extra, [key]: +v });
    const ms = performance.now() - t;
    const loops = outlineDataToLoops(data);
    const met = castabilityMetrics(loops, 100, 8);
    console.log(day, key, v, 'voids', loops.length, 'ms', ms.toFixed(0), 'minWire', met.minWire.toFixed(2));
    res[day][v] = loops;
  }
}
fs.writeFileSync(`${out}/${key}.json`, JSON.stringify(res));
