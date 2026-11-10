// Export a pendant as a binary STL with no OpenCascade, and check it is castable.
//
//   node tools/mesh-export/export-stl.mjs <input.json> <out.stl> [--r 2] [--t 5] [--scale 1]
//
// <input.json> is either the serializeChainsFor3D() outline data
// ({ circleRadius, borderThickness, voidChains }) or the same request body the
// /api/pendant/generate route takes ({ chords, expansion, circleRadius, ... }).
// --r is the edge rounding radius (it steps down by itself where a wire is too
// thin, like Replicad's fillet), --t the thickness, --scale multiplies the
// coordinates (1 = same units as the old Replicad STL export).
import fs from 'fs';
import { buildPendantModel, serializeChainsFor3D } from '../../modules/pendant-geometry.js';
import { buildPendantMesh, meshToSTL } from '../../modules/fast-pendant-mesh.js';
import { topology, selfIntersections } from './mesh-check.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? +args[i + 1] : def; };
const [input, output] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!input || !output) { console.error('usage: export-stl.mjs <input.json> <out.stl> [--r 2] [--t 5] [--scale 1]'); process.exit(1); }

let data = JSON.parse(fs.readFileSync(input, 'utf8'));
if (data.chords) {
  const p = { minArea: 10, minAngle: 15, filletRadius: 2, ...data };
  const model = buildPendantModel(p.chords, p.expansion, p.circleRadius, p.borderThickness, p.minArea, p.minAngle, p.filletRadius);
  data = serializeChainsFor3D(model, p.circleRadius, p.borderThickness);
}

const t0 = performance.now();
const mesh = buildPendantMesh(data, { thickness: flag('t', 5), filletR: flag('r', 2) });
const ms = performance.now() - t0;
fs.writeFileSync(output, Buffer.from(meshToSTL(mesh, { scale: flag('scale', 1) })));

const topo = topology({ V: Float64Array.from(mesh.vertices), T: mesh.triangles });
const si = selfIntersections({ V: Float64Array.from(mesh.vertices), T: mesh.triangles });
const voids = data.voidChains.length;
const ok = topo.watertight && si.hits === 0 && topo.genus === voids;
console.log(JSON.stringify({
  file: output, ms: +ms.toFixed(1), triangles: topo.tris, roundingRadius: +mesh.filletR.toFixed(2),
  watertight: topo.watertight, selfIntersections: si.hits, genus: topo.genus, voids,
  volume: +topo.volume.toFixed(1), castable: ok,
}, null, 1));
process.exit(ok ? 0 : 2);
