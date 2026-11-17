// Birth data → what a flat drawing of the natal chart needs: the ascendant,
// where each planet sits and the aspect lines between them. No canvas.
import { PLANET_KEYS, ascendantDeg, makeHoroscope, type BirthData } from '@/lib/natal-chords';

export type FigureAspect = 'opposition' | 'trine' | 'square' | 'sextile' | 'conjunction';

export interface NatalFigure {
  ascDeg: number;
  planets: { key: string; deg: number }[];   // ecliptic degrees
  lines: { type: FigureAspect; deg1: number; deg2: number }[];
}

const TYPES: FigureAspect[] = ['opposition', 'trine', 'square', 'sextile', 'conjunction'];

/* eslint-disable @typescript-eslint/no-explicit-any */
export function figureForBirth(b: BirthData, enabled: string[]): NatalFigure {
  const h: any = makeHoroscope(b);
  const degs: Record<string, number> = {};
  for (const key of PLANET_KEYS) {
    const body = h.CelestialBodies[key] || (h.CelestialPoints && h.CelestialPoints[key]);
    const ecl = body?.ChartPosition?.Ecliptic?.DecimalDegrees;
    if (typeof ecl === 'number') degs[key] = ecl;
  }
  let aspects: any[] = [];
  try {
    if (h.Aspects?.all) aspects = h.Aspects.all;
    else if (Array.isArray(h.Aspects)) aspects = h.Aspects;
  } catch {}
  const lines: NatalFigure['lines'] = [];
  for (const asp of aspects) {
    const type = (asp.aspectKey || asp.key || '') as FigureAspect;
    if (!TYPES.includes(type) || !enabled.includes(type)) continue;
    const deg1 = degs[asp.point1Key], deg2 = degs[asp.point2Key];
    if (deg1 === undefined || deg2 === undefined) continue;
    lines.push({ type, deg1, deg2 });
  }
  return {
    ascDeg: ascendantDeg(h),
    planets: Object.entries(degs).map(([key, deg]) => ({ key, deg })),
    lines,
  };
}
