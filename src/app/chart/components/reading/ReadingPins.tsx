'use client';

import './reading-variants.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AspectSegment } from '../../chart-engine';
import { useReading, lineFocus } from '@/hooks/useReading';
import type { ReadingLayoutProps } from '../ReadingFlow';
import { IntroSection, LineSection, SummarySection } from './ReadingSections';
import AspectPins from './AspectPins';

interface ReadingPinsProps extends ReadingLayoutProps {
  segments: AspectSegment[];
  // The chart box the pins are placed in (they move with its zoom).
  overlayHost: HTMLElement | null;
}

// Prototype C: numbered pins sit on the lines of the model itself. Clicking
// one zooms to it and opens its meaning here; the panel otherwise shows the
// overview and an index of the same numbers.
export default function ReadingPins({ aspects, bodies, active, onFocus, onBack, onFinish, segments, overlayHost }: ReadingPinsProps) {
  const { lines, big3, summary, chartKey, introFocus } = useReading(aspects, bodies);
  const [sel, setSel] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => { setSel(null); setShowSummary(false); }, [chartKey]);

  const line = sel !== null ? lines[sel] : null;
  useEffect(() => {
    if (!active) return;
    // The overview stays full size here: the pins need the room.
    onFocus(line ? lineFocus(line) : { ...introFocus(), view: undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, line]);

  const pick = (i: number | null) => { setSel(i); setShowSummary(false); };

  return (
    <div className="reading reading-pins">
      {line ? (
        <div className="reading-body" key={sel}>
          <button type="button" className="reading-pins-close" onClick={() => pick(null)}>&larr; All lines</button>
          <LineSection line={line} index={sel!} />
          <div className="reading-pins-step">
            <button type="button" disabled={sel === 0} onClick={() => pick(sel! - 1)} aria-label="Previous line">&larr;</button>
            <span>{sel! + 1} / {lines.length}</span>
            <button type="button" disabled={sel === lines.length - 1} onClick={() => pick(sel! + 1)} aria-label="Next line">&rarr;</button>
          </div>
        </div>
      ) : showSummary ? (
        <div className="reading-body" key="summary">
          <button type="button" className="reading-pins-close" onClick={() => setShowSummary(false)}>&larr; All lines</button>
          <SummarySection summary={summary} />
        </div>
      ) : (
        <div className="reading-body" key="overview">
          <IntroSection big3={big3} lineCount={lines.length} />
          <p className="reading-pins-hint">
            <span className="reading-pins-hint-dot">1</span>
            Tap a number on your pendant to read that line.
          </p>
          <ol className="reading-pins-index">
            {lines.map((l, i) => (
              <li key={i}>
                <button type="button" onClick={() => pick(i)}>
                  <span className="reading-num">{i + 1}</span>
                  <span>{l.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="reading-pins-summary-link" onClick={() => setShowSummary(true)}>
            Your reading, in short &rarr;
          </button>
        </div>
      )}

      <div className="btn-row reading-nav">
        <button type="button" className="controls-back-btn-mobile" onClick={onBack}>&larr; Back</button>
        <button type="button" className="controls-step-btn" onClick={onFinish}>Finish my design</button>
      </div>

      {active && overlayHost && createPortal(
        <AspectPins lines={lines} segments={segments} selected={sel} onSelect={pick} />,
        overlayHost,
      )}
    </div>
  );
}
