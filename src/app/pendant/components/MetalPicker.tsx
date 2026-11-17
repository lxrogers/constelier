import type { MetalId, OfferMetal } from '@/lib/commerce/offer';

// Three colour swatches. The name of the chosen metal shows beside the label.
export default function MetalPicker({ metals, selected, onSelect }: {
  metals: OfferMetal[];
  selected: MetalId;
  onSelect: (id: MetalId) => void;
}) {
  const current = metals.find((m) => m.id === selected);
  return (
    <fieldset className="pdp-option">
      <legend>Metal<span>{current?.name}</span></legend>
      <div className="pdp-metals" role="radiogroup" aria-label="Metal">
        {metals.map((m) => (
          <button
            key={m.id} type="button" role="radio" aria-checked={m.id === selected}
            aria-label={m.name} title={m.name}
            className={`pdp-metal${m.id === selected ? ' on' : ''}`}
            onClick={() => onSelect(m.id)}
          >
            <span className={`pdp-swatch is-${m.id}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
