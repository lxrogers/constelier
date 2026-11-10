'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_BIRTH, DEFAULT_DESIGN, SETTINGS_KEY } from './constants';
import type { BirthData, RingDesign, ViewMode } from './types';

interface Setup { birth: BirthData; design: RingDesign; mode: ViewMode; }

// Birth details live in the URL (same keys as /chart, so a chart link carries
// over); the design choices and the view are remembered in localStorage.
// `ready` turns true once both have been read, after hydration.
export function useSavedSetup() {
  const [setup, setSetup] = useState<Setup>({ birth: DEFAULT_BIRTH, design: DEFAULT_DESIGN, mode: 'flat-first' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = (key: string, fallback: number) => {
      const x = parseFloat(q.get(key) ?? '');
      return Number.isFinite(x) ? x : fallback;
    };
    const birth: BirthData = {
      year: n('y', DEFAULT_BIRTH.year), month: n('m', DEFAULT_BIRTH.month), day: n('d', DEFAULT_BIRTH.day),
      hour: n('h', DEFAULT_BIRTH.hour), minute: n('mi', DEFAULT_BIRTH.minute),
      lat: n('lat', DEFAULT_BIRTH.lat), lon: n('lon', DEFAULT_BIRTH.lon),
      place: q.get('loc') ?? DEFAULT_BIRTH.place,
    };
    let design = DEFAULT_DESIGN, mode: ViewMode = 'flat-first';
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (saved?.design) design = { ...DEFAULT_DESIGN, ...saved.design };
      if (saved?.mode === 'always-3d') mode = 'always-3d';
    } catch {}
    const view = q.get('view');
    if (view === '3d') mode = 'always-3d';
    if (view === 'flat') mode = 'flat-first';
    setSetup({ birth, design, mode });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const { birth, design, mode } = setup;
    const q = new URLSearchParams({
      y: String(birth.year), m: String(birth.month), d: String(birth.day),
      h: String(birth.hour), mi: String(birth.minute),
      lat: String(birth.lat), lon: String(birth.lon), loc: birth.place,
      view: mode === 'always-3d' ? '3d' : 'flat',
    });
    history.replaceState(null, '', '?' + q.toString());
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ design, mode })); } catch {}
  }, [setup, ready]);

  return {
    ...setup,
    ready,
    setBirth: (birth: BirthData) => setSetup(s => ({ ...s, birth })),
    setDesign: (patch: Partial<RingDesign>) => setSetup(s => ({ ...s, design: { ...s.design, ...patch } })),
    setMode: (mode: ViewMode) => setSetup(s => ({ ...s, mode })),
  };
}
