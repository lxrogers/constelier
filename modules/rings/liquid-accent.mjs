/**
 * Localized liquid accent. Direct indexed section loops inspired by ring.js /
 * sineWideTop in lxrogers/generative-rings-testing @ eee66e5d256c7cec17bf3d7cbaa7f966ff39dfbc.
 * Millimetres; Y finger axis; accent faces +Z; no CSG, noise or subdivision.
 *
 * Construction invariant (including the triangulated surface, not just its
 * smooth limit): each angular wedge projects to a non-overlapping annular strip
 * in XZ. Within that strip the upper/lower surfaces are graphs of Y. They share
 * EXACTLY the same projected triangulation and their separation is positive at
 * every interior radial station. Thus their piecewise-linear separation stays
 * positive inside each triangle. Only the intended inner/outer boundary joins
 * touch. Adjacent wedges meet only on their shared section, and all indices are
 * welded. This proves an embedded closed surface even with steep/asymmetric
 * centerlines. Mirrored diagonals below are essential; the usual same diagonal
 * around an entire loop does NOT provide this invariant.
 */

export const LIQUID_ACCENT_CONTROLS = [
  { key: 'innerDiameter', label: 'Inside diameter', min: 14, max: 24, step: 0.1, unit: 'mm', group: 'Fit & shank' },
  { key: 'width', label: 'Shank width', min: 1.6, max: 4, step: 0.1, unit: 'mm', group: 'Fit & shank' },
  { key: 'thickness', label: 'Radial thickness', min: 1.2, max: 3.2, step: 0.05, unit: 'mm', group: 'Fit & shank' },
  { key: 'span', label: 'Accent span', min: 80, max: 170, step: 1, unit: '°', group: 'Liquid accent' },
  { key: 'amplitude', label: 'Crest deflection', min: 0, max: 3.2, step: 0.05, unit: 'mm', group: 'Liquid accent' },
  { key: 'asymmetry', label: 'Asymmetry', min: -0.8, max: 0.8, step: 0.02, unit: '', group: 'Liquid accent' },
  { key: 'accentWidth', label: 'Top width', min: 1.6, max: 9, step: 0.1, unit: 'mm', group: 'Liquid accent' },
  { key: 'radial', label: 'Outer swell', min: 0, max: 3.2, step: 0.05, unit: 'mm', group: 'Liquid accent' },
  { key: 'gloopiness', label: 'Gloopiness', min: 0, max: 1, step: 0.02, unit: '', group: 'Liquid accent' },
];

export const LIQUID_ACCENT_PRESETS = [
  { id: 'flicker', name: 'Flicker', note: 'A fine shank with one lifted, liquid inflection.', params: { innerDiameter: 17.8, width: 1.6, thickness: 1.3, span: 140, amplitude: 1.7, asymmetry: 0.24, accentWidth: 2.1, radial: 0.4, gloopiness: 0.24 } },
  { id: 'molten-crest', name: 'Molten crest', note: 'A broad gold crest drawn into a quiet narrow shank.', params: { innerDiameter: 17.8, width: 2.4, thickness: 1.65, span: 155, amplitude: 2.5, asymmetry: -0.36, accentWidth: 7.8, radial: 2.7, gloopiness: 0.9 } },
  { id: 'undertow', name: 'Undertow', note: 'An off-centre pool and a taut, asymmetric return.', params: { innerDiameter: 17.8, width: 2, thickness: 1.45, span: 120, amplitude: 1.65, asymmetry: 0.6, accentWidth: 4.6, radial: 1.85, gloopiness: 0.66 } },
];
export const LIQUID_ACCENT_DEFAULTS = LIQUID_ACCENT_PRESETS[0].params;
export const LIQUID_ACCENT_MAX_TRIANGLES = 73728;
const TAU = Math.PI * 2;
// max_{|t|<=1} t(1-t²)^3 = (6/7)^3 / sqrt(7).
const CREST_SCALE = Math.sqrt(7) * (7 / 6) ** 3;
const envelope = t => Math.abs(t) < 1 ? (1 - t * t) ** 3 : 0;

export function normalizeLiquidAccent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected liquid accent parameters.');
  const params = { ...LIQUID_ACCENT_DEFAULTS }, adjustments = [];
  for (const c of LIQUID_ACCENT_CONTROLS) {
    const raw = input[c.key] === undefined ? LIQUID_ACCENT_DEFAULTS[c.key] : input[c.key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${c.label} must be a finite number.`);
    const value = Number(Math.max(c.min, Math.min(c.max, c.min + Math.round((raw - c.min) / c.step) * c.step)).toFixed(4));
    params[c.key] = value;
    if (value !== raw) adjustments.push(`${c.label} limited to ${value}${c.unit ? ' ' + c.unit : ''}.`);
  }
  // d[t(1-t²)^3]/dt has absolute maximum 1. The skew map derivative is
  // <= 1 + .9|asymmetry|. Bound axial centreline slope relative to bore arc
  // length by 1.2 for comfortable narrow transitions (not a wall certificate).
  const limit = 1.2 * (params.innerDiameter / 2) * (params.span * Math.PI / 360) /
    (CREST_SCALE * (1 + 0.9 * Math.abs(params.asymmetry)));
  if (params.amplitude > limit) {
    params.amplitude = Number((Math.floor(limit / 0.05) * 0.05).toFixed(2));
    adjustments.push(`Crest deflection limited to ${params.amplitude.toFixed(2)} mm for this size, span and asymmetry.`);
  }
  return { params, adjustments };
}

export function serializeLiquidAccent(input) {
  return JSON.stringify({ version: 1, family: 'liquid-accent', params: normalizeLiquidAccent(input).params });
}
export function parseLiquidAccent(text) {
  if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid ring parameters.');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || data.family !== 'liquid-accent' || !data.params) throw new Error('Unsupported ring preset.');
  return normalizeLiquidAccent(data.params);
}

/** Evaluate a normalized design. Exposed for reproducible section diagnostics. */
export function liquidAccentSection(p, theta) {
  const delta = Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2));
  const s = delta / (p.span * Math.PI / 360);
  if (Math.abs(s) >= 1) return { center: 0, width: p.width, thickness: p.thickness, exponent: 2.4, envelope: 0 };
  // Strictly monotone skew, endpoints fixed. Compact C2 envelopes reach zero
  // with zero first/second derivatives: no hard seam at either accent shoulder.
  const t = s + 0.45 * p.asymmetry * (1 - s * s), e = envelope(t);
  // Offset the outward pool from the axial crest and width peak. Gloopiness
  // changes the distribution and softness of material, never adds random noise.
  const pool = t + 0.3 * p.gloopiness * (1 - t * t);
  return {
    center: p.amplitude * CREST_SCALE * t * e,
    width: p.width + (p.accentWidth - p.width) * e,
    thickness: p.thickness + p.radial * envelope(pool),
    exponent: 2.4 + 1.8 * p.gloopiness * e,
    envelope: e,
  };
}

export function liquidAccentResolution(p, quality = 'settled') {
  if (!['preview', 'settled', 'export'].includes(quality)) throw new Error('Unknown mesh quality.');
  const base = quality === 'preview' ? 128 : quality === 'export' ? 512 : 256;
  const extra = p.span < 110 || Math.abs(p.asymmetry) > 0.6 ? base / 8 : 0;
  return { loops: base + extra, sections: quality === 'preview' ? 24 : quality === 'export' ? 64 : 40 };
}

/** O(vertices + indices) defensive check of this family's graph construction.
 * It rejects unsupported topology, mirrored-coordinate drift, reversed/zero
 * section spacing, an incorrect diagonal, and a folded/collapsed upper sheet.
 * It complements the shared validator, whose published base skips incident faces.
 */
export function validateLiquidAccentConstruction(mesh) {
  const { positions: p, indices: ix, resolution: { loops, sections } = {} } = mesh ?? {};
  const fail = reason => ({ valid: false, reason });
  if (!Number.isInteger(loops) || loops < 128 || loops > 576 || ![24, 40, 64].includes(sections) ||
      !(p instanceof Float32Array) || !(ix instanceof Uint32Array) ||
      p.length !== loops * sections * 3 || ix.length !== loops * sections * 6) return fail('Unsupported liquid mesh layout.');
  const half = sections / 2;
  for (let i = 0; i < loops; i++) {
    const theta = i * TAU / loops, ct = Math.cos(theta), st = Math.sin(theta);
    let previousRadius = Infinity;
    for (let j = 0; j <= half; j++) {
      const a = (i * sections + j) * 3, b = (i * sections + (sections - j) % sections) * 3;
      const r = p[a] * ct + p[a + 2] * st;
      if (![p[a], p[a + 1], p[a + 2], p[b + 1]].every(Number.isFinite)) return fail('Nonfinite section.');
      if (Math.abs(p[a + 2] * ct - p[a] * st) > 0.000004 || r <= 0 || r >= previousRadius) return fail('Non-monotone or rotated radial section.');
      if (p[a] !== p[b] || p[a + 2] !== p[b + 2]) return fail('Unmatched sheet projections.');
      if (j > 0 && j < half && !(p[a + 1] - p[b + 1] > 0.0001)) return fail('Folded or collapsed sheet.');
      previousRadius = r;
    }
    for (let j = 0; j < sections; j++) {
      const a = i * sections + j, b = ((i + 1) % loops) * sections + j;
      const c = ((i + 1) % loops) * sections + (j + 1) % sections, d = i * sections + (j + 1) % sections;
      const expected = j < half ? [a, d, b, b, d, c] : [a, d, c, a, c, b];
      const at = (i * sections + j) * 6;
      for (let k = 0; k < 6; k++) if (ix[at + k] !== expected[k]) return fail('Unmatched sheet triangulation.');
      // Check actual rounded Float32 triangles too: a flipped projection would
      // invalidate the graph argument even if the analytic section is sound.
      for (let k = 0; k < 6; k += 3) {
        const x = ix[at + k] * 3, y = ix[at + k + 1] * 3, z = ix[at + k + 2] * 3;
        const ny = (p[y + 2] - p[x + 2]) * (p[z] - p[x]) - (p[y] - p[x]) * (p[z + 2] - p[x + 2]);
        if (!(ny * (j < half ? 1 : -1) > 1e-10)) return fail('Folded or collapsed triangle projection.');
      }
    }
  }
  return { valid: true, reason: 'Two separated graphs over a welded annulus.' };
}

export function buildLiquidAccent(input, quality = 'settled') {
  const started = performance.now();
  const { params: p, adjustments } = normalizeLiquidAccent(input);
  const { loops, sections } = liquidAccentResolution(p, quality), half = sections / 2;
  const triangles = 2 * loops * sections;
  if (triangles > LIQUID_ACCENT_MAX_TRIANGLES) throw new Error('Mesh budget exceeded.');
  const positions = new Float32Array(loops * sections * 3);
  const normals = new Float32Array(positions.length);
  const indices = new Uint32Array(triangles * 3);
  // Every triangle stays outside this polygon's apothem. Declared bore clearance
  // is independent of all accent controls, with 2 microns for Float32 rounding.
  const innerRadius = (p.innerDiameter / 2 + 0.002) / Math.cos(Math.PI / loops);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < loops; i++) {
    const theta = i * TAU / loops, ct = Math.cos(theta), st = Math.sin(theta);
    const shape = liquidAccentSection(p, theta);
    // Compute each mirrored XZ pair once. Exact equality survives Float32.
    for (let j = 0; j <= half; j++) {
      const phi = j * TAU / sections;
      const c = j === half ? -1 : j === 0 ? 1 : Math.cos(phi);
      const s = j === 0 || j === half ? 0 : Math.sin(phi);
      const f = (Math.abs(c) ** shape.exponent + s ** shape.exponent) ** (-1 / shape.exponent);
      const r = innerRadius + shape.thickness * (c * f + 1) / 2;
      const h = shape.width * s * f / 2;
      const a = (i * sections + j) * 3, b = (i * sections + (sections - j) % sections) * 3;
      positions[a] = positions[b] = r * ct;
      positions[a + 2] = positions[b + 2] = r * st;
      positions[a + 1] = shape.center + h;
      if (b !== a) positions[b + 1] = shape.center - h;
      minY = Math.min(minY, shape.center - h); maxY = Math.max(maxY, shape.center + h);
    }
    for (let j = 0; j < sections; j++) {
      const a = i * sections + j, b = ((i + 1) % loops) * sections + j;
      const c = ((i + 1) % loops) * sections + (j + 1) % sections, d = i * sections + (j + 1) % sections;
      indices.set(j < half ? [a, d, b, b, d, c] : [a, d, c, a, c, b], (i * sections + j) * 6);
    }
  }
  const mesh = {
    positions, normals, indices, params: p, adjustments, family: 'liquid-accent', units: 'mm', quality,
    resolution: { loops, sections }, bounds: { minY, maxY },
    dimensions: { innerDiameter: p.innerDiameter, minRadialWall: p.thickness, axialSectionWidth: p.width },
    generationMs: 0,
  };
  const invariant = validateLiquidAccentConstruction(mesh);
  if (!invariant.valid) throw new Error(`Liquid construction rejected: ${invariant.reason}`);
  for (let k = 0; k < indices.length; k += 3) {
    const a = indices[k] * 3, b = indices[k + 1] * 3, c = indices[k + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const n of [a, b, c]) { normals[n] += nx; normals[n + 1] += ny; normals[n + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (!(length > 0) || !Number.isFinite(length)) throw new Error('Liquid construction produced an invalid normal.');
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  mesh.generationMs = performance.now() - started;
  return mesh;
}

export const LIQUID_ACCENT_FAMILY = {
  id: 'liquid-accent', name: 'Localized liquid accent', controls: LIQUID_ACCENT_CONTROLS,
  presets: LIQUID_ACCENT_PRESETS, normalize: normalizeLiquidAccent, build: buildLiquidAccent,
  serialize: serializeLiquidAccent, parse: parseLiquidAccent,
};
export default LIQUID_ACCENT_FAMILY;
