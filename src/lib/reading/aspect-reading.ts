// Turns a chart's aspects into a step-by-step reading. Pure data: no React,
// no DOM. Each line is broken into three beats — planet one in its sign,
// planet two in its sign, and the specialized meaning of their aspect — plus
// an optional generational insight for slow outer-planet lines.

import { generationalInsight } from './generational';
import { pairReading, type MajorLineAspect } from './pair-readings';
import { placementText } from './placements';

export type AspectKey = 'opposition' | 'trine' | 'square' | 'sextile' | 'conjunction';

export interface ChartAspect {
  aspectKey: string;
  point1Key: string;
  point2Key: string;
  enabled: boolean;
  deg1?: number;
  deg2?: number;
}

export interface ChartBodies {
  ascDeg: number;
  birthYear?: number;
  planets: { key: string; deg: number }[];
}

type Element = 'fire' | 'earth' | 'air' | 'water';
type Mode = 'cardinal' | 'fixed' | 'mutable';

export const SIGNS: { name: string; element: Element; mode: Mode }[] = [
  { name: 'Aries', element: 'fire', mode: 'cardinal' },
  { name: 'Taurus', element: 'earth', mode: 'fixed' },
  { name: 'Gemini', element: 'air', mode: 'mutable' },
  { name: 'Cancer', element: 'water', mode: 'cardinal' },
  { name: 'Leo', element: 'fire', mode: 'fixed' },
  { name: 'Virgo', element: 'earth', mode: 'mutable' },
  { name: 'Libra', element: 'air', mode: 'cardinal' },
  { name: 'Scorpio', element: 'water', mode: 'fixed' },
  { name: 'Sagittarius', element: 'fire', mode: 'mutable' },
  { name: 'Capricorn', element: 'earth', mode: 'cardinal' },
  { name: 'Aquarius', element: 'air', mode: 'fixed' },
  { name: 'Pisces', element: 'water', mode: 'mutable' },
];

export function signOf(deg: number) {
  return SIGNS[Math.floor((((deg % 360) + 360) % 360) / 30)];
}

export function degInSign(deg: number) {
  return Math.floor((((deg % 360) + 360) % 360) % 30);
}

interface PlanetInfo {
  name: string;
  glyph: string;
  short: string; // used inside summary themes
  weight: number; // how central it is to a reading
}

// ︎ keeps the glyphs as text rather than emoji.
export const PLANETS: Record<string, PlanetInfo> = {
  sun: { name: 'Sun', glyph: '☉︎', short: 'your sense of self', weight: 10 },
  moon: { name: 'Moon', glyph: '☽︎', short: 'your emotional life', weight: 9 },
  mercury: { name: 'Mercury', glyph: '☿︎', short: 'your mind', weight: 5 },
  venus: { name: 'Venus', glyph: '♀︎', short: 'your heart', weight: 6 },
  mars: { name: 'Mars', glyph: '♂︎', short: 'your drive', weight: 6 },
  jupiter: { name: 'Jupiter', glyph: '♃︎', short: 'your urge to grow', weight: 4 },
  saturn: { name: 'Saturn', glyph: '♄︎', short: 'your discipline', weight: 4 },
  uranus: { name: 'Uranus', glyph: '♅︎', short: 'your independence', weight: 2 },
  neptune: { name: 'Neptune', glyph: '♆︎', short: 'your imagination', weight: 2 },
  pluto: { name: 'Pluto', glyph: '♇︎', short: 'your depth', weight: 2 },
};

export interface AspectTypeInfo {
  name: string;
  verb: string; // "Sun opposite Mars"
  stepHeading: string; // Step 3 lead: "These are in opposition"
  degrees: number;
  definition: string; // the "how to read a line" entry
  tone: 'hard' | 'soft' | 'blend';
}

export const ASPECT_TYPES: Record<AspectKey, AspectTypeInfo> = {
  opposition: {
    name: 'Opposition',
    verb: 'opposite',
    stepHeading: 'These are in opposition',
    degrees: 180,
    tone: 'hard',
    definition:
      'Across the wheel from each other — the longest lines in your pendant. A tug of war that asks you to hold both ends rather than pick a side.',
  },
  trine: {
    name: 'Trine',
    verb: 'trine',
    stepHeading: 'These form a trine',
    degrees: 120,
    tone: 'soft',
    definition:
      'A third of the circle apart. Natural ease and flow between two parts of your chart — a gift that works best when you use it on purpose.',
  },
  square: {
    name: 'Square',
    verb: 'square',
    stepHeading: 'These form a square',
    degrees: 90,
    tone: 'hard',
    definition:
      'A quarter turn apart, cutting across the chart at right angles. Creative friction that pushes you to move and build.',
  },
  sextile: {
    name: 'Sextile',
    verb: 'sextile',
    stepHeading: 'These form a sextile',
    degrees: 60,
    tone: 'soft',
    definition:
      'A sixth of the circle apart — short lines near the rim. A quiet opening between two planets that rewards you once you reach for it.',
  },
  conjunction: {
    name: 'Conjunction',
    verb: 'conjunct',
    stepHeading: 'These sit in conjunction',
    degrees: 0,
    tone: 'blend',
    definition:
      'In the same slice of the sky. Two planets blended so closely they act as one.',
  },
};

export const TYPE_ORDER: AspectKey[] = ['opposition', 'trine', 'square', 'sextile'];

const TYPE_BONUS: Record<string, number> = { opposition: 3, square: 2.5, trine: 2, sextile: 1, conjunction: 2 };

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ReadingStep {
  glyph: string;
  heading: string; // "Your Sun is in Virgo"
  text: string;    // One crisp sentence about that placement
}

export interface ReadingLine {
  aspect: ChartAspect;
  type: AspectKey;
  kind: string; // "Opposition"
  degrees: number; // 180
  title: string; // "Sun opposite Mars"
  where: string; // "☉︎ 24° Aries · ♂︎ 26° Libra"
  first: ReadingStep;
  second: ReadingStep;
  relation: {
    heading: string; // "These are in opposition"
    text: string;    // Specialized meaning for this planet pair & aspect
  };
  insight: string | null; // Optional generational insight for slow-planet lines
  body: string; // Plain-text summary fallback
}

function placement(key: string, deg?: number) {
  const p = PLANETS[key];
  if (deg === undefined) return p?.glyph ?? key;
  return `${p?.glyph ?? ''} ${degInSign(deg)}° ${signOf(deg).name}`;
}

function stepFor(planetKey: string, deg?: number): ReadingStep {
  const p = PLANETS[planetKey];
  const sign = deg !== undefined ? signOf(deg).name : undefined;
  return {
    glyph: p?.glyph ?? '•',
    heading: sign ? `Your ${p.name} is in ${sign}` : `Your ${p.name}`,
    text: placementText(planetKey, sign),
  };
}

function fallbackRelation(type: AspectKey, a: PlanetInfo, b: PlanetInfo): string {
  switch (type) {
    case 'opposition':
      return `${cap(a.short)} and ${b.short} pull from opposite sides of the chart, asking you to hold both in balance.`;
    case 'trine':
      return `${cap(a.short)} and ${b.short} flow easily into one another, giving you a quiet natural strength here.`;
    case 'square':
      return `${cap(a.short)} and ${b.short} rub against each other, creating friction that pushes both sides to grow.`;
    case 'sextile':
      return `${cap(a.short)} and ${b.short} are on friendly terms, offering an easy opening whenever you lean into it.`;
    case 'conjunction':
      return `${cap(a.short)} and ${b.short} sit right beside each other, acting together as one.`;
  }
}

function score(a: ChartAspect) {
  const w1 = PLANETS[a.point1Key]?.weight ?? 1;
  const w2 = PLANETS[a.point2Key]?.weight ?? 1;
  return w1 + w2 + (TYPE_BONUS[a.aspectKey] ?? 0);
}

// The lines in the pendant, most central first (Sun and Moon before the
// outer planets; oppositions and squares before softer aspects on ties).
export function buildReading(aspects: ChartAspect[], birthYear?: number): ReadingLine[] {
  const usable = aspects.filter(a =>
    a.enabled && a.aspectKey in ASPECT_TYPES && a.aspectKey !== 'conjunction' &&
    PLANETS[a.point1Key] && PLANETS[a.point2Key]);
  const sorted = [...usable].sort((x, y) => score(y) - score(x));
  return sorted.map(aspect => {
    const type = aspect.aspectKey as MajorLineAspect;
    const info = ASPECT_TYPES[type];
    const p1 = PLANETS[aspect.point1Key];
    const p2 = PLANETS[aspect.point2Key];
    const first = stepFor(aspect.point1Key, aspect.deg1);
    const second = stepFor(aspect.point2Key, aspect.deg2);
    const relationText = pairReading(aspect.point1Key, aspect.point2Key, type) ?? fallbackRelation(type, p1, p2);
    const insight = generationalInsight(aspect.point1Key, aspect.point2Key, type, birthYear);
    return {
      aspect,
      type,
      kind: info.name,
      degrees: info.degrees,
      title: `${p1.name} ${info.verb} ${p2.name}`,
      where: `${placement(aspect.point1Key, aspect.deg1)}  ·  ${placement(aspect.point2Key, aspect.deg2)}`,
      first,
      second,
      relation: {
        heading: info.stepHeading,
        text: relationText,
      },
      insight,
      body: `${first.heading}. ${first.text} ${second.heading}. ${second.text} ${info.stepHeading}: ${relationText}`,
    };
  });
}

export interface BigThree {
  sun: string | null;
  moon: string | null;
  rising: string | null;
  headline: string; // "Aries sun, Leo moon, Gemini rising."
  elements: string; // "Fire at your core, ..."
  placements: { label: string; glyph: string; value: string }[];
}

function describeElements(sun?: Element, moon?: Element, rising?: Element): string {
  if (!sun && !moon && !rising) return '';
  if (sun && moon && rising && sun === moon && moon === rising) {
    return `${cap(sun)} all the way through — at your core, in your feelings, and in how you meet the world.`;
  }
  const parts: string[] = [];
  if (sun) parts.push(`${cap(sun)} at your core`);
  if (moon) {
    parts.push(`${sun === moon ? 'more ' + moon : moon} in your feelings`);
  }
  if (rising) {
    const repeats = rising === moon || rising === sun;
    parts.push(`${repeats ? 'and ' + rising + ' again' : 'and ' + rising} in how you meet the world`);
  }
  return parts.join(', ') + '.';
}

export function bigThree(bodies: ChartBodies | null): BigThree {
  const find = (k: string) => bodies?.planets.find(p => p.key === k)?.deg;
  const sunDeg = find('sun');
  const moonDeg = find('moon');
  const ascDeg = bodies?.ascDeg;
  const sun = sunDeg !== undefined ? signOf(sunDeg) : null;
  const moon = moonDeg !== undefined ? signOf(moonDeg) : null;
  const rising = ascDeg !== undefined ? signOf(ascDeg) : null;
  const parts = [
    sun && `${sun.name} sun`,
    moon && `${moon.name} moon`,
    rising && `${rising.name} rising`,
  ].filter(Boolean);
  const fmt = (d?: number) => (d === undefined ? '—' : `${degInSign(d)}° ${signOf(d).name}`);
  return {
    sun: sun?.name ?? null,
    moon: moon?.name ?? null,
    rising: rising?.name ?? null,
    headline: parts.length ? parts.join(', ') + '.' : 'Your chart.',
    elements: describeElements(sun?.element, moon?.element, rising?.element),
    placements: [
      { label: 'Sun', glyph: PLANETS.sun.glyph, value: fmt(sunDeg) },
      { label: 'Moon', glyph: PLANETS.moon.glyph, value: fmt(moonDeg) },
      { label: 'Rising', glyph: 'AC', value: fmt(ascDeg) },
    ],
  };
}

export interface ReadingSummary {
  headline: string;
  balance: string;
  themes: string[];
}

export function summarize(lines: ReadingLine[]): ReadingSummary {
  const hard = lines.filter(l => ASPECT_TYPES[l.type].tone === 'hard').length;
  const soft = lines.filter(l => ASPECT_TYPES[l.type].tone === 'soft').length;
  if (hard === 0 && soft === 0) {
    return {
      headline: 'A quiet sky.',
      balance: 'Very few major lines cross this chart, leaving wide open space in the pendant.',
      themes: [],
    };
  }
  const headline = hard > soft * 1.4
    ? 'Built for tension that turns into motion.'
    : soft > hard * 1.4
      ? 'A chart that flows.'
      : 'Ease and edge, in equal measure.';
  const balance = `${hard} ${hard === 1 ? 'line' : 'lines'} of tension (squares and oppositions), ${soft} of harmony (trines and sextiles).`;
  const themes = lines.slice(0, 3).map(l => {
    const a = PLANETS[l.aspect.point1Key];
    const b = PLANETS[l.aspect.point2Key];
    switch (l.type) {
      case 'opposition': return `${cap(a.short)}, balanced against ${b.short}.`;
      case 'square': return `${cap(a.short)} and ${b.short}, sharpened by friction.`;
      case 'trine': return `${cap(a.short)} and ${b.short}, moving in easy step.`;
      case 'sextile': return `${cap(a.short)} and ${b.short}, working quietly together.`;
      default: return `${cap(a.short)} and ${b.short}, fused.`;
    }
  });
  return { headline, balance, themes };
}
