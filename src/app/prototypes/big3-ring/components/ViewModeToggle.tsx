'use client';

import type { ViewMode } from '../types';

const MODES: Array<{ key: ViewMode; label: string; hint: string }> = [
  { key: 'flat-first', label: 'Flat, then tilt', hint: 'Side-on like the chart while the bodies move, then the ring tips toward you.' },
  { key: 'always-3d', label: 'Always 3D', hint: 'The ring stays tilted; the bodies slide round it under their labels.' },
];

interface Props { value: ViewMode; onChange: (mode: ViewMode) => void; }

export default function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="b3-field">
      <span className="b3-label">Prototype</span>
      <div className="b3-segmented" role="radiogroup" aria-label="Prototype">
        {MODES.map(m => (
          <button
            type="button"
            key={m.key}
            role="radio"
            aria-checked={value === m.key}
            className={value === m.key ? 'active' : ''}
            onClick={() => onChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="b3-hint">{MODES.find(m => m.key === value)?.hint}</p>
    </div>
  );
}
