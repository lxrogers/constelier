// Dump an algorithm's outline loops and rim junction points for one chart.
// node tools/organic-compare/dump.mjs <alg> <YYYY-MM-DD> [out.json]
import fs from 'fs';
import { chordsFor } from './charts.mjs';
import { buildLiquidOutline } from '../../modules/organic/outline-liquid.js';
import { buildPebbleOutline } from '../../modules/organic/outline-pebble.js';
import { buildPendantModel, serializeChainsFor3D } from '../../modules/pendant-geometry.js';
import { outlineDataToLoops } from '../../modules/organic/outline-common.js';
const [alg, day, outPath] = process.argv.slice(2);
const [y, m, d] = day.split('-').map(Number);
const ch = chordsFor({ year: y, month: m, date: d, hour: +(process.env.HOUR||9), minute: 30, lat: 40.71, lon: -74.0 });
const fn = { liquid: c => buildLiquidOutline(c, 100, 8), pebble: c => buildPebbleOutline(c, 100, 8),
  current: c => serializeChainsFor3D(buildPendantModel(c, 3, 100, 8, 185, 5, 5), 100, 8) }[alg];
const data = fn(ch);
const loops = outlineDataToLoops(data, 0.15);
const ang = [...new Set(ch.flatMap(c => [c.a1, c.a2]).map(a => a.toFixed(4)))].map(Number);
fs.writeFileSync(outPath || '/dev/stdout', JSON.stringify({ loops, junctions: ang.map(a => [100 * Math.cos(a), 100 * Math.sin(a)]), data }));
