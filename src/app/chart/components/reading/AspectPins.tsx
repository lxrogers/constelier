'use client';

import { useMemo } from 'react';
import type { AspectSegment } from '../../chart-engine';
import type { ReadingLine } from '@/lib/reading/aspect-reading';

interface AspectPinsProps {
  lines: ReadingLine[];
  segments: AspectSegment[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}

// Where along a line to try placing its pin, best first.
const TRY_T = [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.18, 0.82];
const MIN_GAP = 0.058; // of the chart box, about one pin and a bit

// Numbered pins on the model's lines, in reading order. Lines often cross
// (every opposition runs through the centre), so each pin slides along its
// line until it clears the ones already placed.
export default function AspectPins({ lines, segments, selected, onSelect }: AspectPinsProps) {
  const pins = useMemo(() => {
    const placed: { x: number; y: number; i: number }[] = [];
    lines.forEach((l, i) => {
      const a = l.aspect;
      const seg = segments.find(s =>
        (s.point1Key === a.point1Key && s.point2Key === a.point2Key) ||
        (s.point1Key === a.point2Key && s.point2Key === a.point1Key));
      if (!seg) return;
      let best = { x: 0, y: 0, gap: -1 };
      for (const t of TRY_T) {
        const x = seg.x1 + (seg.x2 - seg.x1) * t;
        const y = seg.y1 + (seg.y2 - seg.y1) * t;
        const gap = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), Infinity);
        if (gap >= MIN_GAP) { best = { x, y, gap }; break; }
        if (gap > best.gap) best = { x, y, gap };
      }
      placed.push({ x: best.x, y: best.y, i });
    });
    return placed;
  }, [lines, segments]);

  return (
    <div className={`aspect-pins${selected !== null ? ' has-selection' : ''}`}>
      {pins.map(p => (
        <button
          key={p.i}
          type="button"
          className={`aspect-pin${selected === p.i ? ' selected' : ''}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          aria-label={`Line ${p.i + 1}: ${lines[p.i].title}`}
          aria-pressed={selected === p.i}
          onClick={() => onSelect(selected === p.i ? null : p.i)}
        >
          {p.i + 1}
          <span className="aspect-pin-tip">{lines[p.i].title}</span>
        </button>
      ))}
    </div>
  );
}
