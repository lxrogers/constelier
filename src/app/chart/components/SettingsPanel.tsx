'use client';

// Customer-facing settings on /chart: only the params marked `prod: true` in
// src/config/pendant-params.ts. Everything else lives in /lab.

import { useState, useRef, useEffect } from 'react';
import ParamControl from '@/components/params/ParamControl';
import { PROD_PARAMS, type PendantParams } from '@/config/pendant-params';
import './SettingsPanel.css';

interface Props {
  params: PendantParams;
  onChange: (next: Partial<PendantParams>, draft: boolean) => void;
}

export default function SettingsPanel({ params, onChange }: Props) {
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

  if (PROD_PARAMS.length === 0) return null;

  return (
    <div className="settings-wrapper">

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
          {PROD_PARAMS.filter((d) => !d.showIf || d.showIf(params)).map((def) => (
            <ParamControl key={def.key} def={def} value={params[def.key]}
              onChange={(v, draft) => onChange({ [def.key]: v } as Partial<PendantParams>, draft)} />
          ))}
        </div>
      )}
    </div>
  );
}
