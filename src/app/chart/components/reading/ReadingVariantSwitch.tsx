'use client';

import './reading-variants.css';
// Prototype toggle for the reading layouts. Remembers the pick in the URL
// (?reading=…) so a link opens the same layout.
export type ReadingVariant = 'steps' | 'list' | 'scroll' | 'pins';

const VARIANTS: { id: ReadingVariant; label: string }[] = [
  { id: 'steps', label: 'Steps' },
  { id: 'list', label: 'List' },
  { id: 'scroll', label: 'Scroll' },
  { id: 'pins', label: 'Pins' },
];

export function readingVariantFromURL(): ReadingVariant {
  const v = new URLSearchParams(window.location.search).get('reading');
  return VARIANTS.some(x => x.id === v) ? (v as ReadingVariant) : 'steps';
}

export default function ReadingVariantSwitch({ value, onChange }: { value: ReadingVariant; onChange: (v: ReadingVariant) => void }) {
  const pick = (v: ReadingVariant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('reading', v);
    window.history.replaceState(null, '', url);
    onChange(v);
  };
  return (
    <div className="reading-variant-switch" role="radiogroup" aria-label="Reading layout prototype">
      <span className="reading-variant-label">Prototype</span>
      {VARIANTS.map(v => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={value === v.id}
          className={value === v.id ? 'on' : ''}
          onClick={() => pick(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
