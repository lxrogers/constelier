import { Horoscope, Origin } from '../../horoscope-bundle.js';
const PLANET_KEYS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
const ENABLED = new Set(['sextile','square','trine','opposition']);
const normDeg = d => ((d % 360) + 360) % 360;
export function chordsFor({ year, month, date, hour, minute, lat, lon }) {
  const origin = new Origin({ year, month: month - 1, date, hour, minute, latitude: lat, longitude: lon });
  const h = new Horoscope({ origin, houseSystem: 'placidus', zodiac: 'tropical', aspectPoints: ['all'], aspectTypes: ['major'], language: 'en' });
  let asc = 0; try { asc = h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees; } catch {}
  const ang = {};
  for (const k of PLANET_KEYS) {
    const b = h.CelestialBodies[k];
    if (b?.ChartPosition?.Ecliptic) ang[k] = normDeg(180 - b.ChartPosition.Ecliptic.DecimalDegrees + asc) * Math.PI / 180;
  }
  const aspects = h.Aspects?.all || [];
  const chords = [];
  for (const a of aspects) {
    if (!ENABLED.has(a.aspectKey)) continue;
    const a1 = ang[a.point1Key], a2 = ang[a.point2Key];
    if (a1 === undefined || a2 === undefined) continue;
    chords.push({ a1, a2 });
  }
  return chords;
}
