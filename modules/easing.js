export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuartic(t) {
  return 1 - Math.pow(1 - t, 4);
}

// CSS-style cubic-bezier(x1, y1, x2, y2): the eased value at time x, both 0 to 1.
export function cubicBezier([x1, y1, x2, y2], x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const at = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
  return at(y1, y2, (lo + hi) / 2);
}

