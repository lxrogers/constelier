import type { OfferSize } from '@/lib/commerce/offer';

export default function SizePicker({ sizes, selected, onSelect }: {
  sizes: OfferSize[];
  selected: number;
  onSelect: (mm: number) => void;
}) {
  const largest = Math.max(...sizes.map((s) => s.mm));
  return (
    <fieldset className="pdp-option">
      <legend>Size<span>{selected} mm across</span></legend>
      <div className="pdp-sizes" role="radiogroup" aria-label="Size">
        {sizes.map((s) => (
          <button
            key={s.mm} type="button" role="radio" aria-checked={s.mm === selected}
            className={`pdp-size${s.mm === selected ? ' on' : ''}`}
            onClick={() => onSelect(s.mm)}
          >
            {/* The discs are drawn to scale with each other. */}
            <span className="pdp-size-disc" aria-hidden="true">
              <span style={{ width: `${(s.mm / largest) * 100}%` }} />
            </span>
            <span className="pdp-size-text">
              <span className="pdp-size-mm">{s.mm} mm</span>
              <span className="pdp-size-blurb">{s.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
