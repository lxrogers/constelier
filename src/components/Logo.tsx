export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" aria-hidden="true">
      <polygon points="50,2 57,40 50,50 43,40" fill="currentColor" />
      <polygon points="98,50 60,57 50,50 60,43" fill="currentColor" />
      <polygon points="50,98 43,60 50,50 57,60" fill="currentColor" />
      <polygon points="2,50 40,43 50,50 40,57" fill="currentColor" />
      <polygon points="55,38 76,24 62,45 50,50" fill="currentColor" />
      <polygon points="62,55 76,76 55,62 50,50" fill="currentColor" />
      <polygon points="45,62 24,76 38,55 50,50" fill="currentColor" />
      <polygon points="38,45 24,24 45,38 50,50" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className || ''}`}>
      <LogoMark className="wordmark-icon" />
      Constelier
    </span>
  );
}
