'use client';

export default function RingControls({ params, controls, onChange }) {
  const groups = Array.from(new Set<string>(controls.map(c => c.group)));
  return <>{groups.map(group => <fieldset className="ring-controls" key={group}>
    <legend>{group}</legend>
    {controls.filter(c => c.group === group).map(c => <label key={c.key} className="ring-control">
      <span>{c.label}<output htmlFor={`ring-${c.key}`}>{c.key === 'section' ? (params[c.key] < 0.12 ? 'Round' : params[c.key] > 0.85 ? 'Soft square' : `${Math.round(params[c.key] * 100)}% square`) : `${params[c.key].toFixed(c.step === 1 ? 0 : c.step < 0.1 ? 2 : 1)} ${c.unit}`}</output></span>
      <input id={`ring-${c.key}`} aria-label={c.label} type="range" min={c.min} max={c.max} step={c.step} value={params[c.key]} style={{ '--progress': `${100 * (params[c.key] - c.min) / (c.max - c.min)}%` } as React.CSSProperties} onChange={e => onChange(c.key, Number(e.target.value))} />
      {c.key === 'section' && <small><span>Round</span><span>Rounded square</span></small>}
    </label>)}
  </fieldset>)}</>;
}
