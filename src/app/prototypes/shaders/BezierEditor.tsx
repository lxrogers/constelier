'use client';
import { useRef } from 'react';
import type { Curve } from './shader-stage-engine';

// A small timing-curve editor: time runs left to right, progress bottom to
// top, and the two handles are the control points of a CSS cubic-bezier.
const SIZE = 132, PAD = 14, SPAN = SIZE - 2 * PAD;
const DEFAULT: Curve = [0.25, 0.8, 0.39, 0.99];
const sx = (x: number) => PAD + x * SPAN, sy = (y: number) => SIZE - PAD - y * SPAN;
const round = (v: number) => Math.round(v * 100) / 100;

export default function BezierEditor({ value, onChange }: { value: Curve; onChange: (c: Curve) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [x1, y1, x2, y2] = value;

  // Time (x) stays between 0 and 1; progress (y) may run a little past either end.
  const set = (i: 0 | 1, x: number, y: number) => {
    const next = [...value] as Curve;
    next[2 * i] = round(Math.min(1, Math.max(0, x)));
    next[2 * i + 1] = round(Math.min(1.3, Math.max(-0.3, y)));
    onChange(next);
  };
  const drag = (i: 0 | 1) => (e: React.PointerEvent<SVGCircleElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const box = svg.current.getBoundingClientRect(), k = SIZE / box.width;
    set(i, ((e.clientX - box.left) * k - PAD) / SPAN, (SIZE - PAD - (e.clientY - box.top) * k) / SPAN);
  };
  const nudge = (i: 0 | 1) => (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key];
    if (!step) return;
    e.preventDefault();
    set(i, value[2 * i] + step[0], value[2 * i + 1] + step[1]);
  };
  const handle = (i: 0 | 1, x: number, y: number) => (
    <circle className="handle" cx={sx(x)} cy={sy(y)} r={6} tabIndex={0} role="slider"
      aria-label={i ? 'End of the curve' : 'Start of the curve'} aria-valuetext={`${x}, ${y}`}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={drag(i)} onKeyDown={nudge(i)} />
  );

  return (
    <div className="sl-bezier">
      <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Timing curve">
        <rect className="frame" x={PAD} y={PAD} width={SPAN} height={SPAN} rx={4} />
        <line className="arm" x1={sx(0)} y1={sy(0)} x2={sx(x1)} y2={sy(y1)} />
        <line className="arm" x1={sx(1)} y1={sy(1)} x2={sx(x2)} y2={sy(y2)} />
        <path className="curve" d={`M${sx(0)} ${sy(0)} C${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`} />
        {handle(0, x1, y1)}
        {handle(1, x2, y2)}
      </svg>
      <div className="sl-bezier-side">
        <span>Timing. Time runs left to right, progress bottom to top.</span>
        <code>cubic-bezier({value.join(', ')})</code>
        <button type="button" onClick={() => onChange(DEFAULT)}>Reset</button>
      </div>
    </div>
  );
}
