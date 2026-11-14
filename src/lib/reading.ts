// Copy for the step-by-step aspect reading.
//
// PLACEHOLDER: the per-aspect readings below are generated from short
// planet and aspect phrases, so every chart gets a reading today. Swap
// `readingFor()` for real, written (or model-written) readings later; the
// UI only calls `readingFor()`, `ASPECT_TYPES` and `PLANETS`.

export type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface AspectType {
  key: AspectKey;
  name: string;
  plural: string;
  glyph: string;
  degrees: number;
  epithet: string;
  intro: string;
  inMetal: string;
}

// Shown once, the first time the reading reaches that kind of aspect.
export const ASPECT_TYPES: Record<AspectKey, AspectType> = {
  opposition: {
    key: 'opposition',
    name: 'Opposition',
    plural: 'Oppositions',
    glyph: '☍',
    degrees: 180,
    epithet: 'The mirror',
    intro:
      'Two planets on opposite sides of the sky, staring each other down. An opposition is a tug of war you were born holding both ends of. You are not meant to pick a side. You are meant to hold the rope.',
    inMetal: 'Oppositions run straight through the center. They are the longest lines you will wear.',
  },
  trine: {
    key: 'trine',
    name: 'Trine',
    plural: 'Trines',
    glyph: '△',
    degrees: 120,
    epithet: 'The flow',
    intro:
      'A third of the circle apart. Trines are the gifts you never had to work for, which is exactly why you forget you have them. Easy, lucky, a little lazy.',
    inMetal: 'Trines are long, calm bridges across the face of the pendant.',
  },
  square: {
    key: 'square',
    name: 'Square',
    plural: 'Squares',
    glyph: '□',
    degrees: 90,
    epithet: 'The friction',
    intro:
      'A quarter turn apart, at right angles to each other. Squares are the itch you keep scratching. They are uncomfortable on purpose: most of what you build, you build out of a square.',
    inMetal: 'Squares cut across other lines at hard angles. A lot of the structure leans on them.',
  },
  sextile: {
    key: 'sextile',
    name: 'Sextile',
    plural: 'Sextiles',
    glyph: '⚹',
    degrees: 60,
    epithet: 'The opening',
    intro:
      'A sixth of the circle apart. A sextile is a door left slightly open. Nothing happens unless you walk through it, but when you do, it tends to go well.',
    inMetal: 'Sextiles are short chords near the rim. Quiet, easy to miss, holding the edge together.',
  },
  conjunction: {
    key: 'conjunction',
    name: 'Conjunction',
    plural: 'Conjunctions',
    glyph: '☌',
    degrees: 0,
    epithet: 'The fusion',
    intro:
      'Two planets in the same place, speaking at once. A conjunction is a blend so complete you may not know where one ends and the other begins.',
    inMetal: 'Conjunctions sit almost on top of each other at the rim.',
  },
};

// The order the reading walks through the types.
export const READING_ORDER: AspectKey[] = ['opposition', 'square', 'trine', 'sextile'];

export interface Planet {
  key: string;
  name: string;
  glyph: string;
  /** What it stands for, as a noun phrase that reads after "your". */
  rules: string;
  /** What it wants, as a verb phrase. */
  wants: string;
}

export const PLANETS: Record<string, Planet> = {
  sun: { key: 'sun', name: 'Sun', glyph: '☉', rules: 'sense of self', wants: 'to be seen as you actually are' },
  moon: { key: 'moon', name: 'Moon', glyph: '☽', rules: 'inner weather', wants: 'to feel safe' },
  mercury: { key: 'mercury', name: 'Mercury', glyph: '☿', rules: 'mind and mouth', wants: 'to make sense of things' },
  venus: { key: 'venus', name: 'Venus', glyph: '♀', rules: 'taste and tenderness', wants: 'to be close to beautiful things' },
  mars: { key: 'mars', name: 'Mars', glyph: '♂', rules: 'drive and temper', wants: 'to go and get it' },
  jupiter: { key: 'jupiter', name: 'Jupiter', glyph: '♃', rules: 'appetite for more', wants: 'to grow past the edges' },
  saturn: { key: 'saturn', name: 'Saturn', glyph: '♄', rules: 'rules and long game', wants: 'to build something that lasts' },
  uranus: { key: 'uranus', name: 'Uranus', glyph: '♅', rules: 'refusal to follow the script', wants: 'to break the pattern' },
  neptune: { key: 'neptune', name: 'Neptune', glyph: '♆', rules: 'dreams and blind spots', wants: 'to dissolve into something bigger' },
  pluto: { key: 'pluto', name: 'Pluto', glyph: '♇', rules: 'power to remake things', wants: 'to get to the bottom of it' },
};

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Frame = (a: Planet, b: Planet) => string;

const FRAMES: Record<AspectKey, Frame[]> = {
  opposition: [
    (a, b) => `Your ${a.name} wants ${a.wants}. Your ${b.name} wants ${b.wants}. They sit across the room from each other and neither will leave first. The work is not choosing; it is letting your ${a.rules} and your ${b.rules} take turns.`,
    (a, b) => `${cap(a.name)} and ${b.name}, face to face. Some days your ${a.rules} wins, some days your ${b.rules} does, and other people notice the swing before you do. Balanced, this is your superpower: you can see both sides because you live on both.`,
    (a, b) => `This is the line you were born pulled along. One end is your ${a.rules}, the other your ${b.rules}. Lean too far either way and the other end yanks back. Stand in the middle and it holds you up.`,
  ],
  square: [
    (a, b) => `Your ${a.name} wants ${a.wants}; your ${b.name} wants ${b.wants}, and right now, please. The friction between your ${a.rules} and your ${b.rules} is not a flaw. It is the engine. Most of what you are proud of started here.`,
    (a, b) => `${cap(a.name)} squares ${b.name}: a corner you keep turning. Your ${a.rules} pushes, your ${b.rules} pushes back. It can feel like getting in your own way. It is also how you got strong.`,
    (a, b) => `A hard angle between your ${a.rules} and your ${b.rules}. You know this one. It is the argument you have with yourself at 2am. Stop trying to win it; build with it instead.`,
  ],
  trine: [
    (a, b) => `Your ${a.name} and your ${b.name} speak the same language. Your ${a.rules} and your ${b.rules} cooperate without being asked, which is why this feels less like a talent and more like just how you are. Use it on purpose.`,
    (a, b) => `${cap(a.name)} in easy step with ${b.name}. Wanting ${a.wants} and wanting ${b.wants} turn out to be the same want. People can feel the ease. You might not, because you have never been without it.`,
    (a, b) => `A gift you did not earn: your ${a.rules} flows straight into your ${b.rules}. Trines can make you coast. This one is worth more if you lean on it when things get hard.`,
  ],
  sextile: [
    (a, b) => `A quiet invitation between your ${a.name} and your ${b.name}. When you let your ${a.rules} talk to your ${b.rules}, small things go right. It only works if you make the first move.`,
    (a, b) => `${cap(a.name)} and ${b.name} are friendly, not fused. Wanting ${a.wants} gives you a way in to ${b.wants.replace(/^to /, '')}. Easy to overlook; worth noticing.`,
    (a, b) => `An open door between your ${a.rules} and your ${b.rules}. Not dramatic. Just useful, the way a good habit is useful. Walk through it more often.`,
  ],
  conjunction: [
    (a, b) => `Your ${a.name} and ${b.name} are fused. Your ${a.rules} and your ${b.rules} act as one, for better and for louder.`,
  ],
};

export interface AspectLike {
  aspectKey: string;
  point1Key: string;
  point2Key: string;
}

export function aspectId(a: AspectLike) {
  return `${a.point1Key}-${a.point2Key}-${a.aspectKey}`;
}

export function planet(key: string): Planet {
  return PLANETS[key] || { key, name: cap(key), glyph: '•', rules: 'nature', wants: 'to be itself' };
}

/** Placeholder reading for one aspect. Deterministic per planet pair. */
export function readingFor(a: AspectLike): string {
  const type = (a.aspectKey as AspectKey) in FRAMES ? (a.aspectKey as AspectKey) : 'trine';
  const frames = FRAMES[type];
  const p1 = planet(a.point1Key);
  const p2 = planet(a.point2Key);
  return frames[hash(a.point1Key + a.point2Key) % frames.length](p1, p2);
}

/** A one-line read of the whole chart, for the closing card. */
export function chartSummary(counts: Partial<Record<AspectKey, number>>): string {
  const hard = (counts.square || 0) + (counts.opposition || 0);
  const soft = (counts.trine || 0) + (counts.sextile || 0);
  if (hard === 0 && soft === 0) return 'A quiet chart. Very few lines, a lot of open sky.';
  if (hard > soft * 1.5) return 'Mostly hard angles. You were built by friction, and it shows in the metal: dense, braced, a lot of crossing lines.';
  if (soft > hard * 1.5) return 'Mostly flow. Long easy bridges and open spaces. The hard part, for you, is choosing what to do with all that ease.';
  return 'An even mix of ease and friction. Some lines carry, some lines brace. That balance is the shape you will wear.';
}
