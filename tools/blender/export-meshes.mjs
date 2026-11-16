// Export the lab's sample pendants (saved defaults) as mm-scale STLs for the
// Blender render scenes.
//
//   node tools/blender/export-meshes.mjs [outDir]
//
// Writes <outDir>/<sample-id>.stl (default tools/blender/meshes) plus
// pendants.json with each pendant's size and bail hole position, which
// render.py uses to thread the chain.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Horoscope, Origin } from '../../horoscope-bundle.js';
import { buildExportMesh, meshOptionsFor } from '../../modules/pendant-build.js';
import { meshToSTL } from '../../modules/fast-pendant-mesh.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.resolve(process.argv[2] || path.join(here, 'meshes'));
fs.mkdirSync(outDir, { recursive: true });

const saved = JSON.parse(fs.readFileSync(path.join(root, 'src/config/pendant-defaults.json'), 'utf8'));

// The saved defaults are in millimetres; the mesh builder works in model
// units (inner circle r = 100). Mirrors withDerived() in
// src/config/pendant-params.ts, which is TypeScript and not importable here.
function withDerived(d) {
  const rimMm = Math.min(d.rimWidthMm, d.diameterMm / 2 - 1);
  const u = 100 / Math.max(1, d.diameterMm / 2 - rimMm);
  return { ...d, borderThickness: rimMm * u, lineThickness: (d.barWidthMm / 2) * u, thickness: d.thicknessMm * u, edgeFillet: d.edgeRoundMm * u };
}
const p = withDerived(saved);

// Same birthdays as src/config/lab-samples.ts.
const SAMPLES = [
  { id: 'chicago-1995', year: 1995, month: 12, day: 3, hour: 18, minute: 20, lat: 41.8781, lon: -87.6298 },
  { id: 'nyc-1990', year: 1990, month: 1, day: 15, hour: 8, minute: 30, lat: 40.7128, lon: -74.006 },
  { id: 'paris-1968', year: 1968, month: 3, day: 9, hour: 11, minute: 5, lat: 48.8566, lon: 2.3522 },
  { id: 'sydney-2010', year: 2010, month: 6, day: 21, hour: 3, minute: 40, lat: -33.8688, lon: 151.2093 },
];

const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const normDeg = (d) => ((d % 360) + 360) % 360;

// Mirrors src/lib/natal-chords.ts (which is TypeScript, so not importable here).
function chordsForBirth(b, enabled) {
  const origin = new Origin({ year: b.year, month: b.month - 1, date: b.day, hour: b.hour, minute: b.minute, latitude: b.lat, longitude: b.lon });
  const h = new Horoscope({ origin, houseSystem: 'placidus', zodiac: 'tropical', aspectPoints: ['all'], aspectTypes: ['major'], language: 'en' });
  let asc = 0;
  try { asc = h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees; } catch {}
  const angles = {};
  for (const k of PLANETS) {
    const ecl = (h.CelestialBodies[k] || h.CelestialPoints?.[k])?.ChartPosition?.Ecliptic?.DecimalDegrees;
    if (typeof ecl === 'number') angles[k] = normDeg(180 - ecl + asc) * Math.PI / 180;
  }
  const on = new Set(enabled);
  const chords = [];
  for (const a of h.Aspects?.all || []) {
    if (!on.has(a.aspectKey || a.key)) continue;
    const a1 = angles[a.point1Key], a2 = angles[a.point2Key];
    if (a1 !== undefined && a2 !== undefined) chords.push({ a1, a2 });
  }
  return chords;
}

const scale = p.diameterMm / (2 * (100 + p.borderThickness));
const meshOpts = meshOptionsFor(p);
const info = { units: 'mm', diameterMm: p.diameterMm, thicknessMm: p.thickness * scale, pendants: [] };

for (const s of SAMPLES) {
  const chords = chordsForBirth(s, p.aspects);
  const mesh = buildExportMesh({
    style: p.outlineStyle, chords, circleRadius: 100, borderThickness: p.borderThickness,
    expansion: p.lineThickness, minArea: p.minArea, minAngle: p.minAngle,
    filletRadius: p.filletRadius, liquidity: p.liquidity,
  }, meshOpts);
  const file = `${s.id}.stl`;
  fs.writeFileSync(path.join(outDir, file), Buffer.from(meshToSTL(mesh, { scale, header: `Constelier ${s.id}` })));
  const V = mesh.vertices;
  const bb = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) {
    bb[0][k] = Math.min(bb[0][k], V[i + k] * scale); bb[1][k] = Math.max(bb[1][k], V[i + k] * scale);
  }
  info.pendants.push({
    id: s.id, file, chords: chords.length, triangles: mesh.triangles.length / 3, bboxMm: bb,
    bail: meshOpts.bail ? { centerMm: [0, meshOpts.bail.cy * scale], holeRadiusMm: meshOpts.bail.innerR * scale, outerRadiusMm: meshOpts.bail.outerR * scale } : null,
  });
  console.log(file, chords.length, 'chords,', mesh.triangles.length / 3, 'tris');
}
fs.writeFileSync(path.join(outDir, 'pendants.json'), JSON.stringify(info, null, 1));
console.log(JSON.stringify(info.pendants.map((x) => ({ id: x.id, bbox: x.bboxMm, bail: x.bail }))));
