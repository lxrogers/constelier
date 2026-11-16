'use client';

import { useId, type ReactNode } from 'react';

// Candidate marks to replace the serif C favicon (and maybe the star in the
// header). Each draws in currentColor on a 64 x 64 grid so it can sit on
// paper or night, at favicon size or large.

const C = 32;
const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [+(C + r * Math.cos(a)).toFixed(2), +(C - r * Math.sin(a)).toFixed(2)] as const;
};
const chord = (a: number, b: number, r: number) => {
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(b, r);
  return { x1, y1, x2, y2 };
};

function Svg({ size, children, title }: { size: number; children: ReactNode; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** 1 · Aspect disc: the chart itself. A ring and the chords of one sky,
 *  laid out like the pendant: a long diagonal and a small triangle. */
export function AspectDisc({ size = 64 }: { size?: number }) {
  const heavy = size <= 24;
  const w = heavy ? 4.5 : 2.6;
  return (
    <Svg size={size}>
      <circle cx={C} cy={C} r={27} fill="none" stroke="currentColor" strokeWidth={w + 0.6} />
      <line {...chord(228, 42, 27)} stroke="currentColor" strokeWidth={w} />
      <line {...chord(246, 104, 27)} stroke="currentColor" strokeWidth={w} />
      {!heavy && <line {...chord(96, 22, 27)} stroke="currentColor" strokeWidth={w * 0.75} />}
    </Svg>
  );
}

/** 2 · The pendant: a solid disc with the voids the chords leave. */
export function PendantMark({ size = 64 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg size={size}>
      <defs>
        <mask id={`m${id}`}>
          <circle cx={C} cy={C} r={29} fill="#fff" />
          <g fill="#000" stroke="#000" strokeWidth={6} strokeLinejoin="round">
            <polygon points="27.5,46.5 45.5,22.5 50,31 47.5,43 37,49.5" />
            <polygon points="17.5,37 20,26 27,21.5" />
          </g>
        </mask>
      </defs>
      <rect width={64} height={64} fill="currentColor" mask={`url(#m${id})`} />
    </Svg>
  );
}

/** 3 · The current eight-point star, kept as the baseline. */
export function StarMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="50,2 57,40 50,50 43,40" fill="currentColor" />
      <polygon points="98,50 60,57 50,50 60,43" fill="currentColor" />
      <polygon points="50,98 43,60 50,50 57,60" fill="currentColor" />
      <polygon points="2,50 40,43 50,50 40,57" fill="currentColor" />
      <polygon points="55,38 76,24 62,45 50,50" fill="currentColor" />
      <polygon points="62,55 76,76 55,62 50,50" fill="currentColor" />
      <polygon points="45,62 24,76 38,55 50,50" fill="currentColor" />
      <polygon points="38,45 24,24 45,38 50,50" fill="currentColor" />
    </svg>
  );
}

/** 4 · Orbit C: a C drawn as an orbit, with a planet in the opening. */
export function OrbitC({ size = 64 }: { size?: number }) {
  const r = 22;
  const [x1, y1] = pt(42, r);
  const [x2, y2] = pt(-42, r);
  return (
    <Svg size={size}>
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 0 ${x2} ${y2}`} fill="none" stroke="currentColor" strokeWidth={size <= 24 ? 8 : 6.5} />
      <circle cx={C + r} cy={C} r={size <= 24 ? 5.5 : 4.5} fill="currentColor" />
    </Svg>
  );
}

/** 5 · Cast C: a thick gold ring with one chord cut out of it. */
export function CastC({ size = 64 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg size={size}>
      <defs>
        <mask id={`c${id}`}>
          <circle cx={C} cy={C} r={28} fill="#fff" />
          <circle cx={C} cy={C} r={17} fill="#000" />
          <rect x={C + 13} y={-20} width={60} height={104} fill="#000" transform={`rotate(-38 ${C} ${C})`} />
        </mask>
      </defs>
      <rect width={64} height={64} fill="currentColor" mask={`url(#c${id})`} />
    </Svg>
  );
}

/** 6 · One aspect: two planets and the line between them. */
export function OneAspect({ size = 64 }: { size?: number }) {
  const heavy = size <= 24;
  const a = pt(212, 26);
  const b = pt(28, 26);
  return (
    <Svg size={size}>
      <circle cx={C} cy={C} r={26} fill="none" stroke="currentColor" strokeWidth={heavy ? 4.5 : 2.5} />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth={heavy ? 4.5 : 2.5} />
      <circle cx={a[0]} cy={a[1]} r={heavy ? 6 : 4.5} fill="currentColor" />
      <circle cx={b[0]} cy={b[1]} r={heavy ? 6 : 4.5} fill="currentColor" />
    </Svg>
  );
}

/** 7 · Constellation C: stars along a C, joined like a constellation. */
export function ConstellationC({ size = 64 }: { size?: number }) {
  const heavy = size <= 24;
  const stars: [number, number, number][] = [
    [48, 23, 0], [104, 24, 0], [150, 21, 0], [196, 23, 0], [244, 22, 0], [300, 24, 1],
  ];
  const pts = stars.map(([d, r]) => pt(d, r));
  return (
    <Svg size={size}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={heavy ? 3.5 : 1.6} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={(heavy ? 5 : 3.4) + (stars[i][2] ? 1.6 : 0)} fill="currentColor" />
      ))}
    </Svg>
  );
}

/** 8 · Sextile star: the six-point figure that trines and sextiles draw. */
export function SextileStar({ size = 64 }: { size?: number }) {
  const heavy = size <= 24;
  const tri = (o: number) => [0, 120, 240].map((d) => pt(d + o, 26).join(',')).join(' ');
  return (
    <Svg size={size}>
      <circle cx={C} cy={C} r={26} fill="none" stroke="currentColor" strokeWidth={heavy ? 4 : 2.5} />
      <polygon points={tri(90)} fill="none" stroke="currentColor" strokeWidth={heavy ? 3.5 : 1.8} strokeLinejoin="round" />
      <polygon points={tri(270)} fill="none" stroke="currentColor" strokeWidth={heavy ? 3.5 : 1.8} strokeLinejoin="round" />
    </Svg>
  );
}
