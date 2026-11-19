// Export what the Blender film (film.py) needs about one pendant: its mesh as
// a millimetre STL, and its outline with the measurements the liquid flow-in
// is modelled from.
//
//   node tools/blender/export-film.mjs
//
// Writes tools/blender/film/pendant.stl and tools/blender/film/pendant.json
// for the hero's first sky, and tools/blender/film/grid/00.stl ... 10.stl for
// the eleven other pendants of the last shot's grid. The settings are the
// saved defaults.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Horoscope, Origin } from '../../horoscope-bundle.js';
import { buildExportMesh, meshOptionsFor, outlineData, pendantExtent, minFeatureFor } from '../../modules/pendant-build.js';
import { meshToSTL, outlineLoops } from '../../modules/fast-pendant-mesh.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'film');
fs.mkdirSync(out, { recursive: true });

const saved = JSON.parse(fs.readFileSync(path.join(root, 'src/config/pendant-defaults.json'), 'utf8'));
// Mirrors withDerived() in src/config/pendant-params.ts (TypeScript, not importable here).
const rimMm = Math.min(saved.rimWidthMm, saved.diameterMm / 2 - 1), u = 100 / Math.max(1, saved.diameterMm / 2 - rimMm);
const p = { ...saved, borderThickness: rimMm * u, lineThickness: (saved.barWidthMm / 2) * u, thickness: saved.thicknessMm * u, edgeFillet: saved.edgeRoundMm * u };

// 15 January 1990, 08:30, New York: HERO_SKIES[0] in src/app/halo/hero/hero-director.ts.
const HERO = { year: 1990, month: 1, day: 15, hour: 8, minute: 30, lat: 40.7128, lon: -74.006 };
// The grid's other pendants: GRID_SKIES in src/app/halo/hero/hero-grid.ts, in the same order.
const NEIGHBOURS = [
  { year: 1975, month: 2, day: 2, hour: 6, minute: 10, lat: 35.6762, lon: 139.6503 },
  { year: 1988, month: 7, day: 14, hour: 14, minute: 45, lat: 38.7223, lon: -9.1393 },
  { year: 2001, month: 10, day: 30, hour: 9, minute: 25, lat: 19.4326, lon: -99.1332 },
  { year: 1962, month: 5, day: 8, hour: 20, minute: 5, lat: 30.0444, lon: 31.2357 },
  { year: 1993, month: 9, day: 19, hour: 1, minute: 50, lat: 49.2827, lon: -123.1207 },
  { year: 1980, month: 4, day: 25, hour: 16, minute: 35, lat: 19.076, lon: 72.8777 },
  { year: 2015, month: 11, day: 11, hour: 11, minute: 11, lat: 64.1466, lon: -21.9426 },
  { year: 1971, month: 6, day: 6, hour: 4, minute: 20, lat: -34.6037, lon: -58.3816 },
  { year: 1998, month: 12, day: 23, hour: 23, minute: 30, lat: 37.5665, lon: 126.978 },
  { year: 2006, month: 3, day: 17, hour: 7, minute: 55, lat: -1.2921, lon: 36.8219 },
  { year: 1985, month: 8, day: 1, hour: 13, minute: 15, lat: 52.52, lon: 13.405 },
];
const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const normDeg = (d) => ((d % 360) + 360) % 360;
// The aspect lines of a birth, as chords of the circle. Mirrors src/lib/natal-chords.ts.
function chordsFor(b) {
  const h = new Horoscope({ origin: new Origin({ year: b.year, month: b.month - 1, date: b.day, hour: b.hour, minute: b.minute, latitude: b.lat, longitude: b.lon }), houseSystem: 'placidus', zodiac: 'tropical', aspectPoints: ['all'], aspectTypes: ['major'], language: 'en' });
  let asc = 0;
  try { asc = h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees; } catch {}
  const angles = {};
  for (const k of PLANETS) {
    const ecl = (h.CelestialBodies[k] || h.CelestialPoints?.[k])?.ChartPosition?.Ecliptic?.DecimalDegrees;
    if (typeof ecl === 'number') angles[k] = normDeg(180 - ecl + asc) * Math.PI / 180;
  }
  const on = new Set(p.aspects), chords = [];
  for (const a of h.Aspects?.all || []) {
    if (!on.has(a.aspectKey || a.key)) continue;
    const a1 = angles[a.point1Key], a2 = angles[a.point2Key];
    if (a1 !== undefined && a2 !== undefined) chords.push({ a1, a2 });
  }
  return chords;
}
const paramsFor = (chords) => ({ style: p.outlineStyle, chords, circleRadius: 100, borderThickness: p.borderThickness, expansion: p.lineThickness, minArea: p.minArea, minAngle: p.minAngle, filletRadius: p.filletRadius, liquidity: p.liquidity });

const chords = chordsFor(HERO);
const params = paramsFor(chords);
const opts = meshOptionsFor(p);
const mmPerUnit = p.diameterMm / (2 * (100 + p.borderThickness));
const mesh = buildExportMesh(params, opts);
fs.writeFileSync(path.join(out, 'pendant.stl'), Buffer.from(meshToSTL(mesh, { scale: mmPerUnit, header: 'Constelier film' })));

// The outline (outer edge with the bail, and the voids), finely sampled, in model units.
const data = outlineData(params);
const loops = outlineLoops(opts.bail ? { ...data, bail: opts.bail } : data, 0.004, 1.5 * Math.PI / 180);
const round2 = (v) => Math.round(v * 1000) / 1000;
fs.writeFileSync(path.join(out, 'pendant.json'), JSON.stringify({
  mmPerUnit, chords: chords.length, triangles: mesh.triangles.length / 3,
  thickness: opts.thickness, edgeRound: mesh.filletR, rimRound: mesh.outerFilletR, rimDrop: Math.min(opts.outerFilletZ, opts.thickness / 2),
  rimWidth: p.borderThickness, rimR: 100, extent: pendantExtent(opts, p.borderThickness), minFeature: minFeatureFor(params),
  loops: loops.map((l) => ({ hole: l.hole, pts: l.pts.map(([x, y]) => [round2(x), round2(y)]) })),
}));
console.log('chords', chords.length, 'triangles', mesh.triangles.length / 3, 'loops', loops.length, loops.map((l) => l.pts.length).join(','), 'mmPerUnit', mmPerUnit.toFixed(4), 'thickness', opts.thickness.toFixed(2), 'edgeRound', mesh.filletR.toFixed(2), 'rim', mesh.outerFilletR.toFixed(2), opts.outerFilletZ.toFixed(2));

fs.mkdirSync(path.join(out, 'grid'), { recursive: true });
NEIGHBOURS.forEach((b, i) => {
  const c = chordsFor(b), m = buildExportMesh(paramsFor(c), opts);
  fs.writeFileSync(path.join(out, 'grid', String(i).padStart(2, '0') + '.stl'), Buffer.from(meshToSTL(m, { scale: mmPerUnit, header: 'Constelier film' })));
  console.log('neighbour', i, 'chords', c.length, 'triangles', m.triangles.length / 3);
});
