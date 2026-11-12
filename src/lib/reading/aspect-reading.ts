// Turns a chart's aspects into a step-by-step reading. Pure data: no React,
// no DOM. Each line is composed from what the two planets mean and how the
// aspect type makes them relate, so it works for any chart.

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
  essence: string; // a phrase: what this planet stands for
  short: string; // a few words, used inside sentences
  weight: number; // how central it is to a reading
}

// ︎ keeps the glyphs as text rather than emoji.
export const PLANETS: Record<string, PlanetInfo> = {
  sun: { name: 'Sun', glyph: '☉︎', essence: 'your core self and vitality', short: 'who you are', weight: 10 },
  moon: { name: 'Moon', glyph: '☽︎', essence: 'your emotional needs and instincts', short: 'what you need', weight: 9 },
  mercury: { name: 'Mercury', glyph: '☿︎', essence: 'how you think and speak', short: 'your mind', weight: 5 },
  venus: { name: 'Venus', glyph: '♀︎', essence: 'how you love and what you value', short: 'your heart', weight: 6 },
  mars: { name: 'Mars', glyph: '♂︎', essence: 'your drive, desire and courage', short: 'your drive', weight: 6 },
  jupiter: { name: 'Jupiter', glyph: '♃︎', essence: 'your faith, growth and generosity', short: 'your appetite for more', weight: 4 },
  saturn: { name: 'Saturn', glyph: '♄︎', essence: 'your discipline and sense of limits', short: 'your discipline', weight: 4 },
  uranus: { name: 'Uranus', glyph: '♅︎', essence: 'your need for freedom and change', short: 'your restlessness', weight: 2 },
  neptune: { name: 'Neptune', glyph: '♆︎', essence: 'your imagination and ideals', short: 'your imagination', weight: 2 },
  pluto: { name: 'Pluto', glyph: '♇︎', essence: 'your capacity for transformation', short: 'your depth', weight: 2 },
};

export interface AspectTypeInfo {
  name: string;
  verb: string; // "Sun opposite Mars"
  degrees: number;
  definition: string; // the "how to read a line" entry
  tone: 'hard' | 'soft' | 'blend';
}

export const ASPECT_TYPES: Record<AspectKey, AspectTypeInfo> = {
  opposition: {
    name: 'Opposition', verb: 'opposite', degrees: 180, tone: 'hard',
    definition: 'Opposite signs, so complementary elements in the same mode. A hard aspect of polarity and awareness, often lived through other people, that asks for integration.',
  },
  trine: {
    name: 'Trine', verb: 'trine', degrees: 120, tone: 'soft',
    definition: 'Signs of the same element. The most harmonious aspect: innate ease and talent, which can drift into complacency.',
  },
  square: {
    name: 'Square', verb: 'square', degrees: 90, tone: 'hard',
    definition: 'Signs of the same mode but clashing elements. A hard aspect of inner tension and crisis that demands action.',
  },
  sextile: {
    name: 'Sextile', verb: 'sextile', degrees: 60, tone: 'soft',
    definition: 'Compatible elements (fire with air, earth with water). A soft aspect of opportunity, which needs effort to pay off.',
  },
  conjunction: {
    name: 'Conjunction', verb: 'conjunct', degrees: 0, tone: 'blend',
    definition: 'The same part of the sky. The two planets fuse and act as one, for better and worse.',
  },
};

export const TYPE_ORDER: AspectKey[] = ['opposition', 'trine', 'square', 'sextile'];

const TYPE_BONUS: Record<string, number> = { opposition: 3, square: 2.5, trine: 2, sextile: 1, conjunction: 2 };

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ReadingLine {
  aspect: ChartAspect;
  type: AspectKey;
  kind: string; // "Opposition"
  title: string; // "Sun opposite Mars"
  where: string; // "☉ 24° Aries · ♂ 26° Libra"
  body: string;
}

function placement(key: string, deg?: number) {
  const p = PLANETS[key];
  if (deg === undefined) return p?.glyph ?? key;
  return `${p?.glyph ?? ''} ${degInSign(deg)}° ${signOf(deg).name}`;
}

function bodyFor(type: AspectKey, a: PlanetInfo, b: PlanetInfo, deg1?: number, deg2?: number): string {
  const s1 = deg1 !== undefined ? signOf(deg1) : null;
  const s2 = deg2 !== undefined ? signOf(deg2) : null;
  const where1 = s1 ? `Your ${a.name} in ${s1.name}` : `Your ${a.name}`;
  const where2 = s2 ? `your ${b.name} in ${s2.name}` : `your ${b.name}`;
  switch (type) {
    case 'opposition':
      return `${where1} faces ${where2} across the chart. ${cap(a.essence)} and ${b.essence} pull opposite ways; the work is letting each keep the other honest.`;
    case 'trine': {
      const shared = s1 && s2 && s1.element === s2.element ? `, both in ${s1.element} signs` : '';
      return `${where1} and ${where2} flow together${shared}. ${cap(a.short)} and ${b.short} support each other so easily it can go unnoticed.`;
    }
    case 'square': {
      const shared = s1 && s2 && s1.mode === s2.mode ? `, both ${s1.mode} signs` : '';
      return `${where1} meets ${where2} at a right angle${shared}. ${cap(a.short)} and ${b.short} want different things at once, and the friction pushes you to act.`;
    }
    case 'sextile':
      return `${where1} and ${where2} are on friendly terms. ${cap(a.essence)} and ${b.essence} help each other once you reach for it.`;
    case 'conjunction':
      return `${where1} sits right beside ${where2}. ${cap(a.essence)} and ${b.essence} fuse, so one is rarely felt without the other.`;
  }
}

function score(a: ChartAspect) {
  const w1 = PLANETS[a.point1Key]?.weight ?? 1;
  const w2 = PLANETS[a.point2Key]?.weight ?? 1;
  return w1 + w2 + (TYPE_BONUS[a.aspectKey] ?? 0);
}

// The lines in the pendant, most central first (Sun and Moon before the
// outer planets; oppositions and squares before softer aspects on ties).
export function buildReading(aspects: ChartAspect[]): ReadingLine[] {
  const usable = aspects.filter(a =>
    a.enabled && a.aspectKey in ASPECT_TYPES && a.aspectKey !== 'conjunction' &&
    PLANETS[a.point1Key] && PLANETS[a.point2Key]);
  const sorted = [...usable].sort((x, y) => score(y) - score(x));
  return sorted.map(aspect => {
    const type = aspect.aspectKey as AspectKey;
    const info = ASPECT_TYPES[type];
    const p1 = PLANETS[aspect.point1Key];
    const p2 = PLANETS[aspect.point2Key];
    return {
      aspect,
      type,
      kind: info.name,
      title: `${p1.name} ${info.verb} ${p2.name}`,
      where: `${placement(aspect.point1Key, aspect.deg1)}  ·  ${placement(aspect.point2Key, aspect.deg2)}`,
      body: bodyFor(type, p1, p2, aspect.deg1, aspect.deg2),
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
  const el = [
    sun && `${cap(sun.element)} at your core`,
    moon && `${sun?.element === moon.element ? 'more ' + moon.element : moon.element} in your feelings`,
    rising && `${rising.element} in how you meet the world`,
  ].filter(Boolean);
  const fmt = (d?: number) => (d === undefined ? '—' : `${degInSign(d)}° ${signOf(d).name}`);
  return {
    sun: sun?.name ?? null,
    moon: moon?.name ?? null,
    rising: rising?.name ?? null,
    headline: parts.length ? parts.join(', ') + '.' : 'Your chart',
    elements: el.length ? el.join(', ') + '.' : '',
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
      case 'trine': return `${cap(a.short)} and ${b.short}, flowing as one.`;
      case 'sextile': return `${cap(a.short)} and ${b.short}, an opening to take.`;
      default: return `${cap(a.short)} and ${b.short}, fused.`;
    }
  });
  return { headline, balance, themes };
}
