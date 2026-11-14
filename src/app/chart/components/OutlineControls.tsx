'use client';

// The outline choice (Liquid, Pebble, Crisp) and Liquid's liquidity slider.
// Controlled: the configurator owns the pendant settings and passes them to
// the chart engine.

import { useEffect, useRef } from 'react';
import { LIQUIDITY } from '@/modules/pendant-build';
import type { OutlineStyle, PendantParams } from '@/config/pendant-params';
import './OutlineControls.css';

type Style = OutlineStyle;

const STYLES: { id: Style; label: string; note: string }[] = [
  { id: 'liquid', label: 'Liquid', note: 'Molten lines that pool where they meet. Drag to set how far the gold flows.' },
  { id: 'pebble', label: 'Pebble', note: 'Soft, rounded openings, like stones worn smooth by water.' },
  { id: 'current', label: 'Crisp', note: 'Clean geometric openings, closest to the chart itself.' },
];

export default function OutlineControls({ variant = 'float', params, onChange }: {
  variant?: 'float' | 'panel';
  params: PendantParams;
  onChange: (next: Partial<PendantParams>, draft: boolean) => void;
}) {
  const style = params.outlineStyle;
  const liquidity = params.liquidity;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show the values a shared link opened with (the engine reads the URL too).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const next: Partial<PendantParams> = {};
    const s = p.get('outline');
    if (s === 'liquid' || s === 'pebble' || s === 'current') next.outlineStyle = s;
    const v = parseFloat(p.get('liq') || '');
    if (Number.isFinite(v)) next.liquidity = Math.min(LIQUIDITY.max, Math.max(LIQUIDITY.min, v));
    if (Object.keys(next).length) onChange(next, false);
    return () => { if (settleTimer.current) clearTimeout(settleTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickStyle(next: Style) {
    onChange({ outlineStyle: next }, false);
  }

  // While dragging: quick draft builds. When the thumb rests (released, or
  // still for a moment), one full-quality build.
  function settle(v: number) {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    onChange({ liquidity: v }, false);
  }
  function onSlide(v: number) {
    onChange({ liquidity: v }, true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(v), 250);
  }

  const pct = ((liquidity - LIQUIDITY.min) / (LIQUIDITY.max - LIQUIDITY.min)) * 100;

  return (
    <div className={`outline-controls outline-${variant}`} role="group" aria-label="Pendant outline">
      <div className="outline-seg">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`outline-seg-btn${style === s.id ? ' active' : ''}`}
            aria-pressed={style === s.id}
            onClick={() => pickStyle(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {variant === 'panel' && (
        <p className="outline-note" key={style}>{STYLES.find((x) => x.id === style)?.note}</p>
      )}
      {style === 'liquid' && (
        <label className="outline-liquidity">
          <span className="outline-liquidity-end">Taut</span>
          <input
            type="range"
            min={LIQUIDITY.min}
            max={LIQUIDITY.max}
            step={LIQUIDITY.step}
            value={liquidity}
            aria-label="Liquidity"
            style={{ ['--fill' as string]: `${pct}%` }}
            onChange={(e) => onSlide(parseFloat(e.target.value))}
            onPointerUp={(e) => settle(parseFloat((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => settle(parseFloat((e.target as HTMLInputElement).value))}
          />
          <span className="outline-liquidity-end">Poured</span>
        </label>
      )}
    </div>
  );
}
