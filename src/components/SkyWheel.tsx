// A decorative natal wheel in thin line work: zodiac ring, sign ticks,
// planet ticks and aspect chords. Drawn as crisp SVG so it stays sharp over
// the gold renders. `draw` animates the chords in.

const SIGNS = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];

// A fixed sample sky (degrees along the ecliptic) and its major aspects.
const PLANETS: [string, number][] = [
  ['☉', 280.4], ['☽', 223.3], ['☿', 271.9], ['♀', 241.5], ['♂', 327.9],
  ['♃', 25.2], ['♄', 40.4], ['♅', 314.8], ['♆', 303.2], ['♇', 251.3],
];

function aspects() {
  const out: [number, number, number][] = [];
  const types = [180, 120, 90, 60];
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      let d = Math.abs(PLANETS[i][1] - PLANETS[j][1]) % 360;
      if (d > 180) d = 360 - d;
      for (const t of types) if (Math.abs(d - t) < 6) out.push([i, j, t]);
    }
  }
  return out;
}

export default function SkyWheel({
  className, draw = true, labels = true, glyphs = true, size = 600, highlight,
}: {
  className?: string; draw?: boolean; labels?: boolean; glyphs?: boolean; size?: number; highlight?: number;
}) {
  const c = size / 2;
  const R = size * 0.46;
  const rIn = size * 0.39;
  const rAsp = size * 0.37;
  const asc = 0;
  const xy = (deg: number, r: number) => {
    const a = ((180 - deg + asc) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const asp = aspects();
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={c} cy={c} r={R} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <circle cx={c} cy={c} r={rIn} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {SIGNS.map((s, i) => {
        const [x1, y1] = xy(i * 30, R);
        const [x2, y2] = xy(i * 30, rIn);
        const [lx, ly] = xy(i * 30 + 15, (R + rIn) / 2);
        let rot = (((270 - (i * 30 + 15) + asc) % 360) + 540) % 360 - 180;
        if (rot > 90) rot -= 180;
        if (rot < -90) rot += 180;
        return (
          <g key={s}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {labels && (
              <text
                x={lx} y={ly}
                fill="currentColor" fillOpacity="0.55"
                fontSize={size * 0.019} letterSpacing={size * 0.004}
                textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${rot} ${lx} ${ly})`}
                style={{ fontFamily: 'var(--sans)' }}
              >
                {s}
              </text>
            )}
          </g>
        );
      })}
      {PLANETS.map(([g, d], i) => {
        const [x1, y1] = xy(d, rIn);
        const [x2, y2] = xy(d, rIn - size * 0.015);
        const [gx, gy] = xy(d, rIn - size * 0.045);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {glyphs && (
              <text x={gx} y={gy} fill="currentColor" fillOpacity="0.8" fontSize={size * 0.03} textAnchor="middle" dominantBaseline="middle">{g}</text>
            )}
          </g>
        );
      })}
      {asp.map(([i, j, t], k) => {
        const [x1, y1] = xy(PLANETS[i][1], rAsp * 0.86);
        const [x2, y2] = xy(PLANETS[j][1], rAsp * 0.86);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const hi = highlight === k;
        return (
          <line
            key={k}
            className={draw ? 'sky-chord' : undefined}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={hi ? 'var(--accent)' : 'currentColor'}
            strokeOpacity={hi ? 1 : t === 90 || t === 180 ? 0.38 : 0.6}
            strokeWidth={hi ? 1.6 : 1}
            strokeDasharray={draw ? len : t === 60 ? '3 4' : undefined}
            style={draw ? ({ ['--len' as string]: len, ['--i' as string]: k } as React.CSSProperties) : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
