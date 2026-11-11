// Export a big-three ring as a binary STL for printing or casting.
//
//   node tools/ring-export/export-ring-stl.mjs out.stl \
//     --y 1992 --m 3 --d 14 --h 19 --mi 30 --lat 38.0464 --lon -84.497 \
//     --asc bar --sun rays --moon side --width 1.2 --thickness 0.8 --size 1 --scale 1
//
// Prints the ring's size and checks the mesh is closed (every edge shared by
// exactly two triangles) before writing.

import fs from 'node:fs';
import { Horoscope, Origin } from '../../horoscope-bundle.js';
import { big3FromHoroscope, layoutGaps, layoutOffsets, buildPrintMesh, formatPosition } from '../../modules/prototypes/big3-ring.js';
import { meshToSTL } from '../../modules/fast-pendant-mesh.js';

const args = process.argv.slice(2);
const out = args[0];
if (!out || out.startsWith('--')) { console.error('usage: export-ring-stl.mjs <out.stl> [--key value ...]'); process.exit(1); }
const opt = { y: 2000, m: 1, d: 1, h: 12, mi: 0, lat: 38.0464, lon: -84.497, asc: 'bar', sun: 'rays', moon: 'side', width: 1.2, thickness: 0.8, size: 1, scale: 1 };
for (let i = 1; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  if (!(key in opt)) { console.error('unknown option', args[i]); process.exit(1); }
  opt[key] = typeof opt[key] === 'number' ? Number(args[i + 1]) : args[i + 1];
}

const origin = new Origin({ year: opt.y, month: opt.m - 1, date: opt.d, hour: opt.h, minute: opt.mi, latitude: opt.lat, longitude: opt.lon });
const big3 = big3FromHoroscope(new Horoscope({ origin, houseSystem: 'placidus', zodiac: 'tropical', aspectPoints: ['all'], aspectTypes: ['major'], language: 'en' }));
const design = { asc: opt.asc, sun: opt.sun, moon: opt.moon, width: opt.width, thickness: opt.thickness, size: opt.size, relief: 0 };
const gaps = layoutGaps(design), off = layoutOffsets(big3, gaps.bodyGap, gaps.ascGap);
const mesh = buildPrintMesh(design, off.sun, off.moon);

// closed? count how many triangles use each edge
const edges = new Map(), T = mesh.triangles;
for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
  const a = T[t + k], b = T[t + (k + 1) % 3], key = a < b ? a * 16777216 + b : b * 16777216 + a;
  edges.set(key, (edges.get(key) || 0) + 1);
}
let open = 0, crowded = 0;
for (const n of edges.values()) { if (n === 1) open++; else if (n > 2) crowded++; }

const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < mesh.vertices.length; i++) { lo[i % 3] = Math.min(lo[i % 3], mesh.vertices[i]); hi[i % 3] = Math.max(hi[i % 3], mesh.vertices[i]); }
const size = lo.map((v, i) => ((hi[i] - v) * opt.scale).toFixed(2));

fs.writeFileSync(out, Buffer.from(meshToSTL(mesh, { scale: opt.scale, header: 'Constelier big-three ring' })));
console.log(`rising ${formatPosition(big3.asc)}, sun ${formatPosition(big3.sun)}, moon ${formatPosition(big3.moon)}`);
console.log(`${T.length / 3} triangles, ${size.join(' x ')} mm at scale ${opt.scale}`);
console.log(open || crowded ? `NOT closed: ${open} open edges, ${crowded} edges shared by more than two triangles` : 'closed: every edge is shared by exactly two triangles');
console.log('wrote', out);
