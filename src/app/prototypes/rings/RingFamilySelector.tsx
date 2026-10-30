'use client';

const planned = [
  { id: 'wave', name: 'Continuous wave' },
  { id: 'liquid-accent', name: 'Liquid accent' },
  { id: 'faceted', name: 'Ribbed & faceted' },
];

export default function RingFamilySelector({ families, selected, onChange }) {
  const choices = [...planned.map(item => families[item.id] || item), ...Object.values(families).filter((item: any) => !planned.some(p => p.id === item.id))] as { id: string; name: string }[];
  return <div className="ring-families" role="group" aria-label="Ring family">
    {choices.map(family => <button key={family.id} data-family-id={family.id} disabled={!families[family.id]} aria-pressed={selected === family.id} onClick={() => onChange(family.id)}>
      <span>{family.name}</span>{!families[family.id] && <small>In development</small>}
    </button>)}
  </div>;
}
