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
