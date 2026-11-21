'use client';

// The pieces of a reading: intro, how to read a line, one line (in three
// beats + optional generational insight), and summary.
import './ReadingSections.css';
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
      {title && <h3 className="reading-title">How to read an aspect line.</h3>}
      <p className="reading-text">
        Each line joins two planets near one of four angles around the circle. The angle sets the tone.
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
      <ol className="reading-steps">
        <li className="reading-step">
          <span className="reading-step-mark" aria-hidden="true">{line.first.glyph}</span>
          <div className="reading-step-copy">
            <p className="reading-step-head">{line.first.heading}</p>
            <p className="reading-step-body">{line.first.text}</p>
          </div>
        </li>
        <li className="reading-step">
          <span className="reading-step-mark" aria-hidden="true">{line.second.glyph}</span>
          <div className="reading-step-copy">
            <p className="reading-step-head">{line.second.heading}</p>
            <p className="reading-step-body">{line.second.text}</p>
          </div>
        </li>
        <li className="reading-step is-relation">
          <span className="reading-step-mark" aria-hidden="true">
            <TypeIcon degrees={line.degrees} size={18} />
          </span>
          <div className="reading-step-copy">
            <p className="reading-step-head">{line.relation.heading}</p>
            <p className="reading-step-body">{line.relation.text}</p>
          </div>
        </li>
      </ol>
      {line.insight && (
        <p className="reading-insight">
          <InsightIcon />
          <span>{line.insight}</span>
        </p>
      )}
    </>
  );
}

export function SummarySection({ summary }: { summary: ReadingSummary }) {
  return (
    <>
      <p className="reading-eyebrow">Your reading, in short</p>
      <h3 className="reading-title">{summary.headline}</h3>
      {summary.themes.length > 0 && (
        <ol className="reading-themes">
          {summary.themes.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      )}
      <p className="reading-text">{summary.balance} Next, request a quote for yours.</p>
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

function InsightIcon() {
  return (
    <svg
      className="reading-insight-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.75 10.68c.55.44.75 1.12.75 1.82V16h6v-.5c0-.7.2-1.38.75-1.82A6 6 0 0 0 12 3Z" />
    </svg>
  );
}
