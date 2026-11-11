'use client';

// One control for one pendant setting, rendered from its definition in
// src/config/pendant-params.ts. Shared by the /chart settings panel and /lab.
//
// Sliders report `draft: true` while dragging and `draft: false` once the
// thumb is released or has rested for a moment, so callers can do a quick
// build mid-drag and one full-quality build at the end.

import { useEffect, useRef } from 'react';
import type { ParamDef, PendantParams, AspectKey } from '@/config/pendant-params';
import './ParamControl.css';

export type ParamValue = PendantParams[keyof PendantParams];

interface Props {
  def: ParamDef;
  value: ParamValue;
  onChange: (value: ParamValue, draft: boolean) => void;
  // Lab extras, rendered after the label.
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

const SETTLE_MS = 250;

export default function ParamControl({ def, value, onChange, badge, actions }: Props) {
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const header = (
    <div className="param-head">
      <span className="param-label" title={def.hint}>{def.label}</span>
      {badge}
      <span className="param-spacer" />
      {actions}
    </div>
  );

  if (def.kind === 'choice') {
    return (
      <div className="param">
        {header}
        <div className="param-seg">
          {def.options.map((o) => (
            <button key={o.value} type="button" aria-pressed={value === o.value}
              className={`param-seg-btn${value === o.value ? ' active' : ''}`}
              onClick={() => onChange(o.value as ParamValue, false)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (def.kind === 'toggle') {
    const on = value as boolean;
    return (
      <div className="param">
        {header}
        <div className="param-seg">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" aria-pressed={on === v}
              className={`param-seg-btn${on === v ? ' active' : ''}`}
              onClick={() => onChange(v, false)}>
              {v ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (def.kind === 'multi') {
    const on = value as AspectKey[];
    return (
      <div className="param">
        {header}
        <div className="param-chips">
          {def.options.map((o) => {
            const active = on.includes(o.value);
            return (
              <button key={o.value} type="button" aria-pressed={active}
                className={`param-chip${active ? ' active' : ''}`}
                onClick={() => onChange(active ? on.filter((v) => v !== o.value) : [...on, o.value], false)}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const num = value as number;
  const clampSnap = (v: number) => {
    const c = Math.min(def.max, Math.max(def.min, v));
    const decimals = (def.step.toString().split('.')[1] || '').length;
    return parseFloat((Math.round(c / def.step) * def.step).toFixed(decimals));
  };
  const settle = (v: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    onChange(v, false);
  };
  const slide = (v: number) => {
    onChange(v, true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(v), SETTLE_MS);
  };
  const pct = ((num - def.min) / (def.max - def.min)) * 100;

  return (
    <div className="param">
      {header}
      <div className="param-row">
        <input type="range" min={def.min} max={def.max} step={def.step} value={num}
          aria-label={def.label} style={{ ['--fill' as string]: `${pct}%` }}
          onChange={(e) => slide(parseFloat(e.target.value))}
          onPointerUp={(e) => settle(parseFloat((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => settle(parseFloat((e.target as HTMLInputElement).value))} />
        <input type="number" min={def.min} max={def.max} step={def.step} value={num}
          onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) settle(clampSnap(v)); }} />
        {def.unit && <span className="param-unit">{def.unit}</span>}
      </div>
    </div>
  );
}
