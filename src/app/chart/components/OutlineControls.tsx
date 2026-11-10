'use client';

// Preview-branch controls: switch the pendant outline between Today, Liquid
// and Pebble, and drag Liquid's liquidity. Talks to chart-engine through
// window events, like the settings panel does through hidden inputs.

import { useEffect, useRef, useState } from 'react';
import { LIQUIDITY } from '@/modules/pendant-build';
import './OutlineControls.css';

type Style = 'current' | 'liquid' | 'pebble';

const STYLES: { id: Style; label: string }[] = [
  { id: 'current', label: 'Today' },
  { id: 'liquid', label: 'Liquid' },
  { id: 'pebble', label: 'Pebble' },
];

function send(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('pendant-outline', { detail }));
}

export default function OutlineControls() {
  const [style, setStyle] = useState<Style>('current');
  const [liquidity, setLiquidity] = useState<number>(LIQUIDITY.default);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick up the starting values the engine read from the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('outline');
    if (s === 'liquid' || s === 'pebble') setStyle(s);
    const v = parseFloat(p.get('liq') || '');
    if (Number.isFinite(v)) setLiquidity(Math.min(LIQUIDITY.max, Math.max(LIQUIDITY.min, v)));
    const onState = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.style) setStyle(d.style);
      if (typeof d.liquidity === 'number') setLiquidity(d.liquidity);
    };
    window.addEventListener('pendant-outline-state', onState);
    return () => {
      window.removeEventListener('pendant-outline-state', onState);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  function pickStyle(next: Style) {
    setStyle(next);
    send({ style: next });
  }

  // While dragging: quick draft builds. When the thumb rests (released, or
  // still for a moment), one full-quality build.
  function settle(v: number) {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    send({ liquidity: v, final: true });
  }
  function onSlide(v: number) {
    setLiquidity(v);
    send({ liquidity: v, final: false });
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(v), 250);
  }

  const pct = ((liquidity - LIQUIDITY.min) / (LIQUIDITY.max - LIQUIDITY.min)) * 100;

  return (
    <div className="outline-controls" role="group" aria-label="Pendant outline">
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
      {style === 'liquid' && (
        <label className="outline-liquidity">
          <span className="outline-liquidity-end">Crisp</span>
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
