// The brand is set in caps: CONSTELIER. Use BRAND in titles and the wordmark;
// running prose can keep "Constelier".
export const BRAND = 'CONSTELIER';

// The Needle star: a four-point star with concave sides drawn out to hairline
// tips, vertical rays longer than the horizontals. `size` is its height.
const NEEDLE = 'M0 -52C3.2 -6.24 4.32 -3.2 36 0C4.32 3.2 3.2 6.24 0 52C-3.2 6.24 -4.32 3.2 -36 0C-4.32 -3.2 -3.2 -6.24 0 -52Z';

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={Math.round((size * 76) / 108)} height={size} viewBox="-38 -54 76 108" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" aria-hidden="true">
      <path d={NEEDLE} fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className || ''}`}>
      <LogoMark className="wordmark-icon" />
      <span className="wordmark-text">{BRAND}</span>
    </span>
  );
}
