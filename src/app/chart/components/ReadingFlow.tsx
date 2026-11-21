'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FocusSpec } from '../chart-engine';
import {
  bigThree, buildReading, summarize,
  type ChartAspect, type ChartBodies,
} from '@/lib/reading/aspect-reading';
import { HowToReadSection, LineSection, SummarySection } from './reading/ReadingSections';
import './ReadingFlow.css';

interface ReadingFlowProps {
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

export default function ReadingFlow({ aspects, bodies, active, onFocus, onBack, onFinish }: ReadingFlowProps) {
  const lines = useMemo(() => buildReading(aspects, bodies?.birthYear), [aspects, bodies?.birthYear]);
  const big3 = useMemo(() => bigThree(bodies), [bodies]);
  const summary = useMemo(() => summarize(lines), [lines]);
  const last = LINES_START + lines.length;
  const [step, setStep] = useState(0);

  // A new chart starts a new reading.
  const chartKey = aspects.map(a => `${a.point1Key}-${a.point2Key}-${a.aspectKey}`).join(',');
  useEffect(() => { setStep(0); }, [chartKey]);

  const line = step >= LINES_START && step < last ? lines[step - LINES_START] : null;

  useEffect(() => {
    if (!active) return;
    if (line) {
      onFocus({ aspects: [line.aspect], zoom: true });
    } else if (step === 0) {
      const sunMoon = aspects.filter(a =>
        a.enabled &&
        ((a.point1Key === 'sun' && a.point2Key === 'moon') || (a.point1Key === 'moon' && a.point2Key === 'sun')));
      onFocus({ aspects: sunMoon, planets: ['sun', 'moon'], zoom: false });
    } else {
      onFocus(null);
    }
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
        {step === 0 && (
          <>
            <p className="reading-eyebrow">Here is your sky</p>
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
              {big3.elements} {lines.length} {lines.length === 1 ? 'line joins' : 'lines join'} your planets.
              Each one is a relationship, and together they are the shape you will wear.
            </p>
          </>
        )}

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
