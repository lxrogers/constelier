'use client';

import { useEffect, useRef, useState } from 'react';
import { BODY_FONTS, HEADLINE_FONTS, type FontOption } from '../font-options';
import './FontBar.css';

// Dev-only bar above the nav for trying other faces on the homepage. It
// overrides --serif and --sans on the .halo root, loads the picked face from
// Google Fonts, and remembers the choice in this browser.

const ROLES = [
  { key: 'headline', label: 'Headlines', cssVar: '--serif', options: HEADLINE_FONTS },
  { key: 'body', label: 'Body', cssVar: '--sans', options: BODY_FONTS },
] as const;

type Picks = Record<(typeof ROLES)[number]['key'], string>;
const DEFAULTS: Picks = { headline: HEADLINE_FONTS[0].name, body: BODY_FONTS[0].name };
const STORE_KEY = 'halo-font-picks';

function loadFace(font: FontOption) {
  if (!font.google) return;
  const id = `fontbar-${font.google}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
}

export default function FontBar() {
  const bar = useRef<HTMLDivElement>(null);
  const [picks, setPicks] = useState<Picks>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
      if (!saved) return;
      // Drop a saved face that is no longer on the list.
      const known = (key: keyof Picks) => ROLES.find((r) => r.key === key)!.options.some((o) => o.name === saved[key]);
      setPicks({ headline: known('headline') ? saved.headline : DEFAULTS.headline, body: known('body') ? saved.body : DEFAULTS.body });
    } catch { /* no saved choice */ }
  }, []);

  useEffect(() => {
    const root = bar.current?.closest<HTMLElement>('.halo');
    if (!root) return;
    for (const role of ROLES) {
      const font = role.options.find((o) => o.name === picks[role.key]);
      if (!font || !font.google) { root.style.removeProperty(role.cssVar); continue; }
      loadFace(font);
      root.style.setProperty(role.cssVar, font.stack);
    }
  }, [picks]);

  const choose = (next: Picks) => {
    setPicks(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
  };

  const changed = ROLES.some((r) => picks[r.key] !== DEFAULTS[r.key]);

  return (
    <div className="fontbar" ref={bar}>
      {ROLES.map((role) => (
        <label key={role.key}>
          <span>{role.label}</span>
          <select value={picks[role.key]} onChange={(e) => choose({ ...picks, [role.key]: e.target.value })}>
            {role.options.map((o) => <option key={o.name}>{o.name}</option>)}
          </select>
        </label>
      ))}
      <button type="button" onClick={() => choose(DEFAULTS)} disabled={!changed}>Reset</button>
    </div>
  );
}
