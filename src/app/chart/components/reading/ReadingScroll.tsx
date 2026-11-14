'use client';

import './reading-variants.css';
import { useEffect, useRef, useState } from 'react';
import { useReading, lineFocus, linesFocus } from '@/hooks/useReading';
import type { ReadingLayoutProps } from '../ReadingFlow';
import { HowToReadSection, IntroSection, LineSection, SummarySection } from './ReadingSections';

// Prototype B: the whole reading as one tall column. Whichever section
// crosses the reading line (a little above the middle of the panel) steers
// the chart. Back / Finish live in a bar pinned to the top.
export default function ReadingScroll({ aspects, bodies, active, onFocus, onBack, onFinish }: ReadingLayoutProps) {
  const { lines, big3, summary, chartKey, introFocus } = useReading(aspects, bodies);
  const rootRef = useRef<HTMLDivElement>(null);
  // Section ids: 'intro', 'how', 'line-<i>', 'summary'.
  const [current, setCurrent] = useState('intro');

  useEffect(() => {
    setCurrent('intro');
    rootRef.current?.closest('#controls')?.scrollTo(0, 0);
  }, [chartKey]);

  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest('#controls');
    if (!root || !scroller || !active) return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) setCurrent((e.target as HTMLElement).dataset.section!);
      }
    }, { root: scroller, rootMargin: '-38% 0px -58% 0px' });
    root.querySelectorAll('[data-section]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [active, chartKey, lines.length]);

  const lineIdx = current.startsWith('line-') ? parseInt(current.slice(5)) : -1;
  const line = lineIdx >= 0 ? lines[lineIdx] : null;

  useEffect(() => {
    if (!active) return;
    if (line) onFocus(lineFocus(line));
    else if (current === 'intro') onFocus(introFocus());
    else if (current === 'how') onFocus(linesFocus());
    else onFocus(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, current, line]);

  const cls = (id: string, extra = '') =>
    `reading-scroll-section${extra ? ' ' + extra : ''}${current === id ? ' current' : ''}`;


  return (
    <div className="reading reading-scroll" ref={rootRef}>
      <div className="reading-scroll-bar">
        <button type="button" className="reading-scroll-back" onClick={onBack}>&larr; Birth details</button>
        <span className="reading-scroll-step" aria-live="polite">
          {line ? `Line ${lineIdx + 1} of ${lines.length}`
            : current === 'how' ? 'How to read'
            : current === 'summary' ? 'In short'
            : ''}
        </span>
        <button type="button" className="controls-step-btn reading-scroll-finish" onClick={onFinish}>Finish my design</button>
      </div>

      <section className={cls('intro', 'is-intro')} data-section="intro">
        {/* No "scroll" hint: the next section peeking in below says it. */}
        <IntroSection big3={big3} lineCount={lines.length} />
      </section>
      <section className={cls('how')} data-section="how">
        <HowToReadSection />
      </section>
      {lines.map((l, i) => (
        <section key={i} className={cls(`line-${i}`, 'is-line')} data-section={`line-${i}`}>
          <LineSection line={l} index={i} />
        </section>
      ))}
      <section className={cls('summary', 'is-summary')} data-section="summary">
        <SummarySection summary={summary} />
        <div className="btn-row">
          <button type="button" className="controls-step-btn" onClick={onFinish}>Finish my design</button>
        </div>
      </section>
    </div>
  );
}
