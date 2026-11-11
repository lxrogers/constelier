// Birth data → the aspect chords the pendant is cut from. The same math the
// chart page uses, without any canvas, so the lab can build pendants for
// several birthdays at once.
import { Horoscope, Origin } from '@/lib/horoscope';

export interface BirthData {
  year: number; month: number; day: number; // month 1-12
  hour: number; minute: number;
  lat: number; lon: number;
}

export interface Chord { a1: number; a2: number }

export const PLANET_KEYS = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

const normDeg = (d: number) => ((d % 360) + 360) % 360;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function makeHoroscope(b: BirthData): any {
  const origin = new Origin({
    year: b.year, month: b.month - 1, date: b.day, hour: b.hour, minute: b.minute,
    latitude: b.lat, longitude: b.lon,
  });
  return new Horoscope({
    origin,
    houseSystem: 'placidus',
    zodiac: 'tropical',
    aspectPoints: ['all'],
    aspectTypes: ['major'],
    language: 'en',
  });
}

export function ascendantDeg(h: any): number {
  try { return h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees; }
  catch { try { return h.Houses[0].ChartPosition.StartPosition.Ecliptic.DecimalDegrees; } catch { return 0; } }
}

// Planet angles on the pendant circle (radians, canvas orientation) and one
// chord per enabled aspect between two of them.
export function chordsFromHoroscope(h: any, ascDeg: number, enabled: Set<string> | string[]): Chord[] {
  const on = enabled instanceof Set ? enabled : new Set(enabled);
  const angles: Record<string, number> = {};
  for (const key of PLANET_KEYS) {
    const body = h.CelestialBodies[key] || (h.CelestialPoints && h.CelestialPoints[key]);
    const ecl = body?.ChartPosition?.Ecliptic?.DecimalDegrees;
    if (typeof ecl === 'number') angles[key] = normDeg(180 - ecl + ascDeg) * Math.PI / 180;
  }
  let aspects: any[] = [];
  try {
    if (h.Aspects?.all) aspects = h.Aspects.all;
    else if (Array.isArray(h.Aspects)) aspects = h.Aspects;
  } catch {}
  const chords: Chord[] = [];
  for (const asp of aspects) {
    const key = asp.aspectKey || asp.key || '';
    if (!on.has(key)) continue;
    const a1 = angles[asp.point1Key], a2 = angles[asp.point2Key];
    if (a1 === undefined || a2 === undefined) continue;
    chords.push({ a1, a2 });
  }
  return chords;
}

export function chordsForBirth(b: BirthData, enabled: Set<string> | string[]): Chord[] {
  const h = makeHoroscope(b);
  return chordsFromHoroscope(h, ascendantDeg(h), enabled);
}
