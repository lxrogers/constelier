'use client';

// The pieces of a reading, shared by every layout (steps, list, scroll, pins).
import {
  ASPECT_TYPES, TYPE_ORDER,
  type BigThree, type ReadingLine, type ReadingSummary,
} from '@/lib/reading/aspect-reading';

export function IntroSection({ big3, lineCount }: { big3: BigThree; lineCount: number }) {
  return (
    <>
      <h3 className="reading-title">{big3.headline}</h3>
      <div className="reading-big3">
        {big3.placements.map(p => (
          <div key={p.label} className="reading-big3-cell">
            <span className="reading-big3-glyph">{p.glyph}</span>
            <span className="reading-big3-label">{p.label}</span>
            <span className="reading-big3-value">{p.value}</span>
          </div>
        ))}
      </div>
      <p className="reading-text">
        {big3.elements} {lineCount} {lineCount === 1 ? 'line joins' : 'lines join'} your planets.
        Each one is a relationship, and together they are the shape you will wear.
      </p>
    </>
  );
}

export function HowToReadSection({ title = true }: { title?: boolean }) {
  return (
    <>
      {title && <h3 className="reading-title">How to read a line.</h3>}
      <p className="reading-text">
        Each line joins two planets. The angle between them, measured around the circle, sets the tone.
      </p>
      <ul className="reading-types">
        {TYPE_ORDER.map(key => {
          const t = ASPECT_TYPES[key];
          return (
            <li key={key} className="reading-type">
              <TypeIcon degrees={t.degrees} />
              <div>
                <span className="reading-type-name">{t.name}</span>
                <span className="reading-type-deg"> · {t.degrees}°</span>
                <p className="reading-type-def">{t.definition}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function LineSection({ line, index }: { line: ReadingLine; index?: number }) {
  return (
    <>
      <div className="reading-meta">
        {index !== undefined && <span className="reading-num">{index + 1}</span>}
        <span className="reading-kind">{line.kind}</span>
        <span className="reading-where">{line.where}</span>
      </div>
      <h3 className="reading-title">{line.title}</h3>
      <p className="reading-text reading-text-lg">{line.body}</p>
    </>
  );
}

export function SummarySection({ summary }: { summary: ReadingSummary }) {
  return (
    <>
      <p className="reading-eyebrow">Your reading, in short</p>
      <h3 className="reading-title">{summary.headline}</h3>
      <ol className="reading-themes">
        {summary.themes.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
      <p className="reading-text">{summary.balance} Next, choose how your pendant is made.</p>
    </>
  );
}

// A small circle with one chord at the aspect's angle.
export function TypeIcon({ degrees, size = 32 }: { degrees: number; size?: number }) {
  const start = 90 + degrees / 2;
  const pt = (a: number) => {
    const r = (a * Math.PI) / 180;
    return { x: 20 + 16 * Math.cos(r), y: 20 - 16 * Math.sin(r) };
  };
  const p = pt(start), q = pt(start - degrees);
  return (
    <svg className="reading-type-icon" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="16" fill="none" stroke="#d4cfc5" strokeWidth="1.2" />
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#3a3630" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
