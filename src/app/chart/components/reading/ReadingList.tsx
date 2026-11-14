'use client';

import './reading-variants.css';
import { useEffect, useState } from 'react';
import { ASPECT_TYPES } from '@/lib/reading/aspect-reading';
import { useReading, lineFocus } from '@/hooks/useReading';
import type { ReadingLayoutProps } from '../ReadingFlow';
import { HowToReadSection, SummarySection, TypeIcon } from './ReadingSections';

// Prototype A: every line on one screen. Opening a line zooms the chart to
// it; with nothing open the chart sits back on the whole pendant.
export default function ReadingList({ aspects, bodies, active, onFocus, onBack, onFinish }: ReadingLayoutProps) {
  const { lines, big3, summary, chartKey, introFocus } = useReading(aspects, bodies);
  const [open, setOpen] = useState<number | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => { setOpen(null); }, [chartKey]);

  const line = open !== null ? lines[open] : null;
  useEffect(() => {
    if (!active) return;
    onFocus(line ? lineFocus(line) : introFocus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, line]);

  return (
    <div className="reading reading-list">
      <div className="reading-list-head">
        <h3 className="reading-title">{big3.headline}</h3>
        <p className="reading-text">
          {big3.elements} Open any of your {lines.length} lines to read it.
        </p>
      </div>

      <ul className="reading-acc">
        {lines.map((l, i) => {
          const isOpen = open === i;
          return (
            <li key={i} className={`reading-acc-item${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="reading-acc-head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <TypeIcon degrees={ASPECT_TYPES[l.type].degrees} size={26} />
                <span className="reading-acc-title">{l.title}</span>
                <span className="reading-acc-kind">{l.kind}</span>
                <span className="reading-acc-chev" aria-hidden="true" />
              </button>
              <div className="reading-acc-panel">
                <div>
                  <p className="reading-where">{l.where}</p>
                  <p className="reading-text">{l.body}</p>
                </div>
              </div>
            </li>
          );
        })}
        <li className={`reading-acc-item reading-acc-how${howOpen ? ' open' : ''}`}>
          <button type="button" className="reading-acc-head" aria-expanded={howOpen} onClick={() => setHowOpen(!howOpen)}>
            <span className="reading-acc-title">How to read a line</span>
            <span className="reading-acc-chev" aria-hidden="true" />
          </button>
          <div className="reading-acc-panel"><div><HowToReadSection title={false} /></div></div>
        </li>
      </ul>

      <details className="reading-list-summary">
        <summary>Your reading, in short</summary>
        <div className="reading-body"><SummarySection summary={summary} /></div>
      </details>

      <div className="btn-row reading-nav">
        <button type="button" className="controls-back-btn-mobile" onClick={onBack}>&larr; Back</button>
        <button type="button" className="controls-step-btn" onClick={onFinish}>Finish my design</button>
      </div>
    </div>
  );
}
