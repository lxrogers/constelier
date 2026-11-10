'use client';

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import type { RingStage, RingStageView } from './ring-stage-engine';
import type { Big3, RingDesign } from './types';

interface StageRefs {
  wrap: RefObject<HTMLDivElement | null>;
  wheel: RefObject<HTMLCanvasElement | null>;
  gl: RefObject<HTMLCanvasElement | null>;
  labels: RefObject<HTMLCanvasElement | null>;
}

// Owns the imperative stage: creates it once, feeds it the latest chart,
// design and view, and tears it down on unmount.
export function useRingStage(refs: StageRefs, big3: Big3 | null, design: RingDesign, view: RingStageView) {
  const stageRef = useRef<RingStage | null>(null);
  const latest = useRef({ big3, design, view });
  latest.current = { big3, design, view };

  useEffect(() => {
    const { wrap, wheel, gl, labels } = refs;
    if (!wrap.current || !wheel.current || !gl.current || !labels.current) return;
    let cancelled = false;
    let stage: RingStage | null = null;
    (async () => {
      const { createRingStage } = await import('./ring-stage-engine');
      if (cancelled) return;
      stage = await createRingStage(
        { wrap: wrap.current!, wheel: wheel.current!, gl: gl.current!, labels: labels.current! },
        latest.current.design, latest.current.view,
      );
      if (cancelled) { stage.destroy(); return; }
      stageRef.current = stage;
      // anything that changed while the scene was loading
      stage.setDesign(latest.current.design);
      stage.setView(latest.current.view);
      if (latest.current.big3) stage.setChart(latest.current.big3);
    })();
    return () => {
      cancelled = true;
      stageRef.current = null;
      stage?.destroy();
    };
    // refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (big3) stageRef.current?.setChart(big3); }, [big3]);
  useEffect(() => { stageRef.current?.setDesign(design); }, [design]);
  useEffect(() => { stageRef.current?.setView(view); }, [view]);

  const replay = useCallback(() => stageRef.current?.replay(), []);
  return { replay };
}
