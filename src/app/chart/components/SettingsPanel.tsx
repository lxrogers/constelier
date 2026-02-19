'use client';

import { useState, useRef, useEffect } from 'react';
import './SettingsPanel.css';

interface SliderParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const PARAMS: SliderParam[] = [
  { id: 'border-thickness', label: 'Border Thickness', min: 0, max: 20, step: 0.5, defaultValue: 8 },
  { id: 'line-thickness', label: 'Line Thickness', min: 0.5, max: 8, step: 0.1, defaultValue: 3 },
  { id: 'fillet-radius', label: '2D Fillet Radius', min: 0, max: 20, step: 0.5, defaultValue: 5 },
];

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="settings-wrapper">
      {/* Hidden inputs always in DOM so chart-engine can bind listeners on init */}
      {PARAMS.map((p) => (
        <input key={p.id} type="hidden" id={p.id} defaultValue={p.defaultValue} />
      ))}

      <button
        ref={buttonRef}
        className={`settings-gear${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Settings"
      >
        <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M450-130v-220h60v80h320v60H510v80h-60Zm-320-80v-60h220v60H130Zm160-160v-80H130v-60h160v-80h60v220h-60Zm160-80v-60h380v60H450Zm160-160v-220h60v80h160v60H670v80h-60Zm-480-80v-60h380v60H130Z"/>
        </svg>
      </button>

      {open && (
        <div ref={panelRef} className="settings-panel">
          <h3>Pendant Settings</h3>
          {PARAMS.map((param) => (
            <ParamRow key={param.id} param={param} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParamRow({ param }: { param: SliderParam }) {
  const [value, setValue] = useState(param.defaultValue);

  function handleChange(next: number) {
    // Clamp to valid range
    const clamped = Math.min(param.max, Math.max(param.min, next));
    // Snap to step
    const snapped = Math.round(clamped / param.step) * param.step;
    // Fix floating point
    const decimals = (param.step.toString().split('.')[1] || '').length;
    const final = parseFloat(snapped.toFixed(decimals));
    setValue(final);

    // Dispatch to hidden input so chart-engine picks it up
    const hidden = document.getElementById(param.id) as HTMLInputElement | null;
    if (hidden) {
      hidden.value = String(final);
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  return (
    <div className="settings-param">
      <label>{param.label}</label>
      <div className="settings-param-row">
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
        />
        <input
          type="number"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value) || param.min)}
        />
      </div>
    </div>
  );
}
