'use client';

import { useEffect, useState } from 'react';
import type { BirthData } from '@/lib/natal-chords';
import type { NatalFigure } from '@/lib/natal-figure';

// Works the chart out in the browser, loading the astronomy code only when
// a page actually draws a chart. Null until it is ready (or if it fails).
export function useNatalFigure(birth: BirthData | undefined, aspects: string[] | undefined) {
  const [figure, setFigure] = useState<NatalFigure | null>(null);
  const key = birth ? JSON.stringify([birth, aspects]) : '';
  useEffect(() => {
    if (!birth) { setFigure(null); return; }
    let live = true;
    import('@/lib/natal-figure')
      .then((m) => { if (live) setFigure(m.figureForBirth(birth, aspects ?? [])); })
      .catch(() => { if (live) setFigure(null); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return figure;
}
