'use client';

interface Option { key: string; label: string; }

interface Props {
  label: string;
  options: Option[];
  value: string;
  onChange: (key: string) => void;
}

// One marker's look: step through the options with the arrows or pick a dot.
export default function StyleCycler({ label, options, value, onChange }: Props) {
  const index = Math.max(0, options.findIndex(o => o.key === value));
  const step = (d: number) => onChange(options[(index + d + options.length) % options.length].key);

  return (
    <div className="b3-cycler">
      <span className="b3-cycler-label">{label}</span>
      <div className="b3-cycler-control">
        <button type="button" className="b3-cycler-arrow" onClick={() => step(-1)} aria-label={`Previous ${label} style`}>&lsaquo;</button>
        <div className="b3-cycler-value">
          <span aria-live="polite">{options[index].label}</span>
          <span className="b3-cycler-dots">
            {options.map(o => (
              <button
                type="button"
                key={o.key}
                className={`b3-cycler-dot${o.key === value ? ' active' : ''}`}
                onClick={() => onChange(o.key)}
                aria-label={`${label}: ${o.label}`}
              />
            ))}
          </span>
        </div>
        <button type="button" className="b3-cycler-arrow" onClick={() => step(1)} aria-label={`Next ${label} style`}>&rsaquo;</button>
      </div>
    </div>
  );
}
