// Rebuild a set of pendants from birth data, as STL, with two settings sets:
// "march" (the generator as it stood in March 2026, approximate) and "now"
// (the newest defaults known). Birth data is read from a JSON file kept out
// of the repo.
//
//   node tools/march-remake/build.mjs <people.json> <outDir> [settings.json]
//
// people.json: [{ "id": "sample", "label": "Sample", "year": 2000, "month": 1,
//   "day": 1, "hour": 12, "minute": 0, "lat": 40.71, "lon": -74.01 }, ...]
// Keep people.json out of the repo: it holds customers' birth details.
// Times are local to the birthplace; the horoscope library finds the zone.
import fs from 'fs';
import path from 'path';
import { Horoscope, Origin } from '../../horoscope-bundle.js';
import { outlineData, minFeatureFor } from '../../modules/pendant-build.js';
import { buildPendantMesh, meshToSTL } from '../../modules/fast-pendant-mesh.js';
import { topology } from '../mesh-export/mesh-check.mjs';

const PLANET_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const normDeg = (d) => ((d % 360) + 360) % 360;

// Settings sets. Units: inner circle radius = 100; diameterMm sets the scale.
export const SETTINGS = {
  march: { // origin/server-render (Mar 11 2026) chart defaults; 24 mm per the Mar 18 mail
    style: 'current', expansion: 3, borderThickness: 8, filletRadius: 5, minArea: 185, minAngle: 5,
    thickness: 5, filletR: 2, diameterMm: 24,
    aspects: ['opposition', 'trine', 'square', 'sextile'],
  },
  now: { // Control panel defaults as last seen (Nov 11); see README for gaps
    style: 'liquid', liquidity: 11, expansion: 4.5, borderThickness: 11.75, filletRadius: 5, minArea: 185, minAngle: 5,
    thickness: 10.75, filletR: 2.5, diameterMm: 25,
    aspects: ['opposition', 'trine', 'square', 'sextile'],
  },
};

export function chordsFor(p, aspects) {
  const origin = new Origin({ year: p.year, month: p.month - 1, date: p.day, hour: p.hour, minute: p.minute, latitude: p.lat, longitude: p.lon });
  const h = new Horoscope({ origin, houseSystem: 'placidus', zodiac: 'tropical', aspectPoints: ['all'], aspectTypes: ['major'], language: 'en' });
  const asc = h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees;
  const ang = {};
  for (const k of PLANET_KEYS) {
    const e = h.CelestialBodies[k]?.ChartPosition?.Ecliptic?.DecimalDegrees;
    if (typeof e === 'number') ang[k] = normDeg(180 - e + asc) * Math.PI / 180;
  }
  const chords = [];
  for (const a of h.Aspects.all) {
    if (!aspects.includes(a.aspectKey)) continue;
    const a1 = ang[a.point1Key], a2 = ang[a.point2Key];
    if (a1 !== undefined && a2 !== undefined) chords.push({ a1, a2, key: `${a.point1Key}-${a.aspectKey}-${a.point2Key}` });
  }
  return chords;
}

export function build(p, S) {
  const chords = chordsFor(p, S.aspects);
  const params = { style: S.style, chords, circleRadius: 100, borderThickness: S.borderThickness, expansion: S.expansion,
    minArea: S.minArea, minAngle: S.minAngle, filletRadius: S.filletRadius, liquidity: S.liquidity };
  const data = outlineData(params);
  const mesh = buildPendantMesh(data, { thickness: S.thickness, filletR: S.filletR, minFeature: minFeatureFor(params) });
  const mm = S.diameterMm / (2 * (100 + S.borderThickness));
  const topo = topology({ V: Float64Array.from(mesh.vertices), T: mesh.triangles });
  return { chords, data, mesh, mm, topo };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [peopleFile, outDir, settingsFile] = process.argv.slice(2);
  if (!peopleFile || !outDir) { console.error('usage: build.mjs <people.json> <outDir> [settings.json]'); process.exit(1); }
  const people = JSON.parse(fs.readFileSync(peopleFile, 'utf8'));
  const sets = settingsFile ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : SETTINGS;
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const p of people) {
    for (const [name, S] of Object.entries(sets)) {
      const { chords, data, mesh, mm, topo } = build(p, S);
      const file = path.join(outDir, `${p.id}-${name}.stl`);
      fs.writeFileSync(file, Buffer.from(meshToSTL(mesh, { scale: mm, header: `Constelier ${p.label} ${name}` })));
      const vol = Math.abs(topo.volume) * mm ** 3;
      report.push({ id: p.id, set: name, chords: chords.length, voids: data.voidChains.length,
        watertight: topo.watertight, genus: topo.genus, triangles: topo.tris,
        diameterMm: S.diameterMm, thicknessMm: +(S.thickness * mm).toFixed(2), roundingMm: +(mesh.filletR * mm).toFixed(2),
        volumeMm3: +vol.toFixed(0), grams14k: +(vol / 1000 * 13.07).toFixed(2), gramsSilver: +(vol / 1000 * 10.36).toFixed(2), file });
      console.log(JSON.stringify(report.at(-1)));
    }
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
}
