export const defaults = { groups: 3, rings: 3, rays: 16, stroke: 0.45, spacing: 3.1, depth: 1.2 };
export const limits = { groups: [1, 5, 1], rings: [1, 5, 1], rays: [6, 32, 1], stroke: [0.3, 0.8, 0.05], spacing: [2, 3.5, 0.1], depth: [0.6, 2.4, 0.1] };
export const presets = { Reference: defaults, Quiet: { ...defaults, groups: 1, rings: 2, rays: 8 }, Waves: { ...defaults, groups: 5, rings: 4, rays: 24, spacing: 2.2 }, Bold: { ...defaults, groups: 2, rings: 2, rays: 12, stroke: 0.8, depth: 1.8 } };
export function normalize(input = {}) {
  return Object.fromEntries(Object.entries(limits).map(([key, [min, max, step]]) => {
    const value = input[key] ?? defaults[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${key}`);
    return [key, Math.max(min, Math.min(max, step === 1 ? Math.round(value) : value))];
  }));
}

// Shared construction for the instant SVG and the CAD kernel.
export function layout(input) {
  const p = normalize(input), sun = { x: -2, y: -1.5, radius: 6.4 };
  const rays = Array.from({ length: p.rays }, (_, i) => {
    const a = i * Math.PI * 2 / p.rays, dx = Math.cos(a), dy = Math.sin(a), w = p.stroke / 2;
    const point = (r, side) => [sun.x + dx * r - dy * w * side, sun.y + dy * r + dx * w * side];
    return [point(5.8, 1), point(35, 1), point(35, -1), point(5.8, -1)];
  });
  const centers = [[15, -1], [-3, 16], [11, 11], [-13, 9], [8, -13]];
  const groups = centers.slice(0, p.groups).map(([x, y], i) => {
    const outer = [12.5, 13, 12.5, 11, 11][i];
    return { x, y, maskRadius: outer - p.stroke, rings: Array.from({ length: p.rings }, (_, j) => outer - j * Math.min(p.spacing, (outer - 1.3) / Math.max(1, p.rings - 1))) };
  });
  return { params: p, sun, rays, groups, radius: 15, rim: 0.65 };
}
