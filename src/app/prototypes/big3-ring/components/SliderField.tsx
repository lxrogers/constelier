'use client';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

export default function SliderField({ label, value, min, max, step, format, onChange }: Props) {
  return (
    <label className="b3-slider">
      <span className="b3-slider-head">
        <span>{label}</span>
        <span className="b3-slider-value">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </label>
  );
}
