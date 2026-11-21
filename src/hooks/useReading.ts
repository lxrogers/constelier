import { useMemo } from 'react';
import type { FocusSpec } from '@/app/chart/chart-engine';
import {
  bigThree, buildReading, summarize,
  type ChartAspect, type ChartBodies, type ReadingLine,
} from '@/lib/reading/aspect-reading';

// Everything a reading layout needs from the chart, plus the two focus
// shapes they all use (the wide opening view and one line up close).
export function useReading(aspects: ChartAspect[], bodies: ChartBodies | null) {
  const lines = useMemo(() => buildReading(aspects, bodies?.birthYear), [aspects, bodies?.birthYear]);
  const big3 = useMemo(() => bigThree(bodies), [bodies]);
  const summary = useMemo(() => summarize(lines), [lines]);
  // Changes when the chart does, so layouts can reset.
  const chartKey = aspects.map(a => `${a.point1Key}-${a.point2Key}-${a.aspectKey}`).join(',');

  const introFocus = (): FocusSpec => {
    const sunMoon = aspects.filter(a =>
      a.enabled &&
      ((a.point1Key === 'sun' && a.point2Key === 'moon') || (a.point1Key === 'moon' && a.point2Key === 'sun')));
    return { aspects: sunMoon, planets: ['sun', 'moon'], view: 'wide' };
  };

  return { lines, big3, summary, chartKey, introFocus };
}

// "How to read an aspect line": the chart's lines, with the pendant faded back.
export const linesFocus = (): FocusSpec => ({ aspects: [], view: 'lines' });

export const lineFocus = (line: ReadingLine): FocusSpec => ({ aspects: [line.aspect], zoom: true });
