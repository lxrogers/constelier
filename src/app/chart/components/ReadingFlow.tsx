'use client';

import { useEffect, useState } from 'react';
import type { FocusSpec } from '../chart-engine';
import type { ChartAspect, ChartBodies } from '@/lib/reading/aspect-reading';
import { useReading, lineFocus, linesFocus } from '@/hooks/useReading';
import { HowToReadSection, IntroSection, LineSection, SummarySection } from './reading/ReadingSections';
import './ReadingFlow.css';

export interface ReadingLayoutProps {
  aspects: ChartAspect[];
  bodies: ChartBodies | null;
  // Hidden flows keep their place but stop steering the chart.
  active: boolean;
  onFocus: (spec: FocusSpec | null) => void;
  onBack: () => void;
  onFinish: () => void;
}

// Steps: overview, how-to-read, one per line, summary.
const LINES_START = 2;

export default function ReadingFlow({ aspects, bodies, active, onFocus, onBack, onFinish }: ReadingLayoutProps) {
  const { lines, big3, summary, chartKey, introFocus } = useReading(aspects, bodies);
  const last = LINES_START + lines.length;
  const [step, setStep] = useState(0);

  // A new chart starts a new reading.
  useEffect(() => { setStep(0); }, [chartKey]);

  const line = step >= LINES_START && step < last ? lines[step - LINES_START] : null;

  useEffect(() => {
    if (!active) return;
    if (line) onFocus(lineFocus(line));
    else if (step === 0) onFocus(introFocus());
    else if (step === 1) onFocus(linesFocus());
    else onFocus(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, line]);

  const go = (s: number) => setStep(Math.max(0, Math.min(last, s)));
  const back = () => (step === 0 ? onBack() : go(step - 1));
  const nextLabel = step === 0 ? 'How do I read it?'
    : step === 1 ? (lines.length ? 'Read my first line' : 'See my summary')
    : step === last - 1 ? 'Sum it up'
    : 'Next line';

  return (
    <div className="reading">
      {line && (
        <div className="reading-progress">
          <span className="reading-progress-label">Line {step - LINES_START + 1} of {lines.length}</span>
          <div className="reading-dots">
            {lines.map((l, i) => {
              const s = LINES_START + i;
              return (
                <button
                  key={i}
                  type="button"
                  className={`reading-dot${s === step ? ' current' : s < step ? ' done' : ''}`}
                  aria-label={`Go to ${l.title}`}
                  aria-current={s === step ? 'step' : undefined}
                  onClick={() => go(s)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="reading-body" key={step}>
        {step === 0 && <IntroSection big3={big3} lineCount={lines.length} />}
        {step === 1 && <HowToReadSection />}
        {line && <LineSection line={line} />}
        {step === last && <SummarySection summary={summary} />}
      </div>

      <div className="btn-row reading-nav">
        <button type="button" className="controls-back-btn-mobile" onClick={back}>&larr; Back</button>
        {step === last ? (
          <button type="button" className="controls-step-btn" onClick={onFinish}>Finish my design</button>
        ) : (
          <button type="button" className="controls-step-btn" onClick={() => go(step + 1)}>{nextLabel}</button>
        )}
      </div>
    </div>
  );
}
