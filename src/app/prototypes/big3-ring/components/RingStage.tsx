'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useRingStage } from '../useRingStage';
import type { Big3, RingDesign, ViewMode } from '../types';

export interface RingStageHandle {
  replay(): void;
  getView(): { tiltDeg: number; tiltDir: number } | null;
  resetView(): void;
}

interface Props {
  big3: Big3 | null;
  design: RingDesign;
  mode: ViewMode;
  showWheel: boolean;
  showLabels: boolean;
}

// The picture: zodiac wheel canvas, WebGL ring, label canvas, stacked.
// Drag on it to orbit, scroll to zoom.
const RingStage = forwardRef<RingStageHandle, Props>(function RingStage({ big3, design, mode, showWheel, showLabels }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const wheel = useRef<HTMLCanvasElement>(null);
  const gl = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLCanvasElement>(null);
  const view = useMemo(() => ({ mode, showWheel, showLabels }), [mode, showWheel, showLabels]);
  const { replay, getView, resetView } = useRingStage({ wrap, wheel, gl, labels }, big3, design, view);
  useImperativeHandle(ref, () => ({ replay, getView, resetView }), [replay, getView, resetView]);

  return (
    <div className="b3-stage" ref={wrap}>
      <canvas ref={wheel} className="b3-layer" />
      <canvas ref={gl} className="b3-layer b3-layer-gl" />
      <canvas ref={labels} className="b3-layer" />
    </div>
  );
});

export default RingStage;
