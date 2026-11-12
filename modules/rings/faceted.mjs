/**
 * Ribbed / pinched / faceted widebands. Direct welded section loops inspired by
 * generative-rings-testing/ring.js @ eee66e5d, with no CSG or subdivision.
 * Millimetres, Y finger axis, origin at bore centre. Tests check the local
 * radial-projection invariant; finite wall sampling is not certification.
 */
export const FACETED_CONTROLS = [
  { key: 'innerDiameter', label: 'Inside diameter', min: 14, max: 24, step: 0.1, unit: 'mm', group: 'Fit & section' },
  { key: 'width', label: 'Band width', min: 4, max: 10, step: 0.1, unit: 'mm', group: 'Fit & section' },
  { key: 'thickness', label: 'Base wall', min: 1.5, max: 3.2, step: 0.05, unit: 'mm', group: 'Fit & section' },
  { key: 'segments', label: 'Cell count', min: 6, max: 36, step: 1, unit: '', group: 'Relief' },
  { key: 'depth', label: 'Groove depth', min: 0, max: 1.6, step: 0.01, unit: 'mm', group: 'Relief' },
  { key: 'faceRatio', label: 'Broad face', min: 0.25, max: 0.8, step: 0.01, unit: '', group: 'Relief' },
  { key: 'tilt', label: 'Slant across width', min: -0.8, max: 0.8, step: 0.01, unit: 'cells', group: 'Relief' },
  { key: 'softness', label: 'Edge softness', min: 0, max: 1, step: 0.01, unit: '', group: 'Relief' },
];

export const FACETED_PRESETS = [
  { id: 'pinch', name: 'Pinch', note: 'Broad rounded ribs, narrow gathered grooves.', params: { innerDiameter: 17.8, width: 7.2, thickness: 1.65, segments: 14, depth: 0.65, faceRatio: 0.65, tilt: 0, softness: 0.9 } },
  { id: 'flute', name: 'Flute', note: 'A close rhythm of straight vertical flutes.', params: { innerDiameter: 17.8, width: 8, thickness: 1.6, segments: 36, depth: 0.26, faceRatio: 0.48, tilt: 0, softness: 0.6 } },
  { id: 'chisel', name: 'Chisel', note: 'Straight diagonal facets, fine polished edges.', params: { innerDiameter: 17.8, width: 5.8, thickness: 1.8, segments: 14, depth: 0.55, faceRatio: 0.6, tilt: 0.5, softness: 0 } },
];
export const FACETED_DEFAULTS = FACETED_PRESETS[0].params;
export const FACETED_MAX_TRIANGLES = 73728;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function normalizeFaceted(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ring parameters must be an object.');
  const params = { ...FACETED_DEFAULTS }, adjustments = [];
  for (const c of FACETED_CONTROLS) {
    const raw = input[c.key] ?? FACETED_DEFAULTS[c.key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${c.label} must be a finite number.`);
    const value = Number(clamp(c.min + Math.round((raw - c.min) / c.step) * c.step, c.min, c.max).toFixed(4));
    params[c.key] = value;
    if (raw !== value) adjustments.push(`${c.label} limited to ${value}${c.unit ? ' ' + c.unit : ''}.`);
  }
  // Limit the relief's aspect ratio, including its axial shear. Depth ADDS to
  // the protected base wall: increasing it can never cut into the finger bore.
  const pitch = TAU * (params.innerDiameter / 2 + params.thickness) / params.segments;
  const run = pitch * Math.min(params.faceRatio, (1 - params.faceRatio) / 2);
  const rim = 0.08 + 0.42 * params.softness, bevel = 0.24 + 0.28 * params.softness;
  const slope = Math.max(1.8 / params.width, 1 / ((1 - rim) * (params.width - 2 * bevel)));
  const limit = Math.min(1.6, 0.95 * run / Math.hypot(1, slope * params.tilt * pitch));
  if (params.depth > limit) {
    params.depth = Number((Math.floor((limit + 1e-10) * 100) / 100).toFixed(2));
    adjustments.push(`Groove depth limited to ${params.depth.toFixed(2)} mm for this cell spacing and slant; the base wall stays intact.`);
  }
  return { params, adjustments };
}

export function serializeFaceted(input) {
  return JSON.stringify({ version: 1, family: 'faceted', params: normalizeFaceted(input).params });
}
export function parseFaceted(text) {
  if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid ring parameters.');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || data.family !== 'faceted' || !data.params) throw new Error('Unsupported ring preset.');
  return normalizeFaceted(data.params);
}

export function facetedResolution(input, quality = 'settled') {
  if (!['preview', 'settled', 'export'].includes(quality)) throw new Error('Unknown mesh quality.');
  const p = normalizeFaceted(input).params;
  const perCell = { preview: 8, settled: 16, export: 32 }[quality];
  const tilted = p.tilt !== 0;
  const sections = tilted ? { preview: 14, settled: 24, export: 40 }[quality] : { preview: 12, settled: 20, export: 32 }[quality];
  // Keep small-count rings round, without losing an integer number of cells.
  const budget = { preview: 6912, settled: 23040, export: 73728 }[quality];
  const loops = tilted ? Math.floor(budget / (2 * sections * p.segments)) * p.segments
    : p.segments * Math.max(perCell, Math.ceil(96 / p.segments));
  return { loops, sections };
}

// Ray/line intersection on a periodic polygonal cell. Broad faces are actual
// chords, not a normal-map effect. Circular smoothing rounds the corners; the
// soft rib component gives a domed crest instead of a flat cylinder plateau.
function polygonRadius(phase, root, depth, count, faceRatio, softness) {
  const t = phase - Math.floor(phase), a = (1 - faceRatio) / 2;
  const angle = TAU / count;
  const ray = phase => {
    const t = phase - Math.floor(phase);
    const left = t < a ? 0 : t < 1 - a ? a : 1 - a;
    const right = t < a ? a : t < 1 - a ? 1 - a : 1;
    const r0 = left === 0 ? root : root + depth, r1 = right === 1 ? root : root + depth;
    const u = (t - left) * angle, span = (right - left) * angle;
    const numerator = r0 * r1 * Math.sin(span);
    const denominator = r1 * Math.sin(span - u) + r0 * Math.sin(u);
    const derivative = angle * (-r1 * Math.cos(span - u) + r0 * Math.cos(u));
    return [numerator / denominator, -numerator * derivative / denominator ** 2];
  };
  // Join adjacent exact chord faces with a C1 Hermite bevel. A discrete blur
  // of polygon samples produced tiny derivative steps visible in gold; this
  // analytic transition keeps its slope continuous at each edge.
  const width = Math.min(0.025 + 0.075 * softness, 0.45 * Math.min(a, faceRatio));
  const knot = [0, a, 1 - a, 1].find(k => Math.abs(t - k) < width);
  let radius;
  if (knot === undefined) radius = ray(t)[0];
  else {
    const [r0, d0] = ray(knot - width), [r1, d1] = ray(knot + width);
    const u = (t - knot + width) / (2 * width), u2 = u * u, u3 = u2 * u;
    radius = (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * 2 * width * d0
      + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * 2 * width * d1;
  }
  let height = clamp(radius - root, 0, depth);
  const knee = 0.05 * depth;
  if (height < knee) height = height * height * (2 * knee - height) / (knee * knee);
  return height;
}
function relief(phase, root, p) {
  if (p.depth === 0) return 0;
  const polygon = polygonRadius(phase, root, p.depth, p.segments, p.faceRatio, p.softness);
  const exponent = 2.5 - 2.1 * p.faceRatio;
  const dome = p.depth * (0.5 - 0.5 * Math.cos(TAU * phase)) ** exponent;
  return clamp(polygon * (1 - p.softness) + dome * p.softness, 0, p.depth);
}

// Anticlockwise section in (radial, axial). Common Y rows follow periodic
// sampling rails around a rounded rectangle. No repeated corners.
function sectionPoints(p, quality) {
  const [outer, inner, cap, corner] = (p.tilt !== 0
    ? { preview: [6, 2, 1, 1], settled: [12, 2, 1, 2], export: [20, 4, 2, 3] }
    : { preview: [4, 2, 1, 1], settled: [6, 4, 1, 2], export: [12, 4, 2, 3] })[quality];
  const b = 0.24 + 0.28 * p.softness, h = p.width / 2, t = p.thickness;
  const points = [];
  const line = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) points.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, x1 - x0, y1 - y0]);
  };
  const arc = (x, y, start) => {
    for (let i = 0; i < corner; i++) {
      const a = start + Math.PI / 2 * i / corner;
      points.push([x + b * Math.cos(a), y + b * Math.sin(a), -Math.sin(a), Math.cos(a)]);
    }
  };
  line(t, -h + b, t, h - b, outer);
  arc(t - b, h - b, 0);
  line(t - b, h, b, h, cap);
  arc(b, h - b, Math.PI / 2);
  line(0, h - b, 0, -h + b, inner);
  arc(b, -h + b, Math.PI);
  line(b, -h, t - b, -h, cap);
  arc(t - b, -h + b, Math.PI * 1.5);
  return points;
}

function slantAt(y, p) {
  const bevel = 0.24 + 0.28 * p.softness;
  const v = clamp(y / (p.width - 2 * bevel) + 0.5, 0, 1);
  const rim = 0.08 + 0.42 * p.softness;
  const ramp = v < rim ? v * v / (2 * rim) : v > 1 - rim
    ? 1 - rim - (1 - v) ** 2 / (2 * rim) : v - rim / 2;
  return { value: ramp / (1 - rim) - 0.5,
    derivative: Math.min(1, v / rim, (1 - v) / rim) / ((1 - rim) * (p.width - 2 * bevel)) };
}

export function buildFaceted(input, quality = 'settled') {
  const started = performance.now();
  const { params: p, adjustments } = normalizeFaceted(input);
  const { loops, sections } = facetedResolution(p, quality);
  const triangleCount = 2 * loops * sections;
  if (triangleCount > FACETED_MAX_TRIANGLES) throw new Error('Mesh budget exceeded.');
  const profile = sectionPoints(p, quality);
  if (profile.length !== sections) throw new Error('Section budget mismatch.');
  const positions = new Float32Array(loops * sections * 3);
  const normals = new Float32Array(positions.length);
  const indices = new Uint32Array(triangleCount * 3);
  // Follow each diagonal feature with the angular sampling rails. No normals
  // or vertices are split. Account for the largest angular span of a triangle,
  // including rail shear, rather than just its horizontal angular step.
  const slants = profile.map(([, y]) => slantAt(y, p));
  const shear = p.tilt * TAU / p.segments;
  const maxSpan = TAU / loops + Math.abs(shear) * Math.max(...slants.map((s, j) => Math.abs(s.value - slants[(j + 1) % sections].value)));
  const inner = (p.innerDiameter / 2 + 0.002) / Math.cos(maxSpan / 2);
  for (let i = 0; i < loops; i++) {
    for (let j = 0; j < sections; j++) {
      const [x, y, dx, dy] = profile[j];
      const theta = i * TAU / loops + shear * slants[j].value;
      const c = Math.cos(theta), s = Math.sin(theta);
      const phase = i * p.segments / loops;
      // The entire inner wall AND its comfort fillets stay independent of the
      // design. Only the outer half of the section receives radial relief.
      const weight = Math.max(0, 2 * x / p.thickness - 1);
      const height = relief(phase, inner + p.thickness, p);
      const r = inner + x + weight * height;
      // Tangents of the same continuous surface produce stable normals even
      // while the interactive tessellation is coarse. Actual bevels stay in
      // positions; these normals do not split or duplicate any mesh vertex.
      const epsilon = 1e-4;
      const dh = (relief(phase + epsilon, inner + p.thickness, p) - relief(phase - epsilon, inner + p.thickness, p)) / (2 * epsilon);
      const rTheta = weight * dh * p.segments / TAU;
      const rY = weight * dh * -p.tilt * slants[j].derivative;
      const rSection = dx * (1 + (x > p.thickness / 2 ? 2 * height / p.thickness : 0)) + rY * dy;
      const nx = r * dy * c + dy * rTheta * s, ny = -r * rSection, nz = r * dy * s - dy * rTheta * c;
      const length = Math.hypot(nx, ny, nz);
      if (!Number.isFinite(length) || length === 0) throw new Error('Degenerate section normal.');
      const at = (i * sections + j) * 3;
      positions.set([r * c, y, r * s], at);
      normals.set([nx / length, ny / length, nz / length], at);
      const a = i * sections + j, b = ((i + 1) % loops) * sections + j;
      const d = i * sections + (j + 1) % sections, e = ((i + 1) % loops) * sections + (j + 1) % sections;
      indices.set([a, d, b, b, d, e], (i * sections + j) * 6);
    }
  }
  return { positions, normals, indices, params: p, adjustments, family: 'faceted', units: 'mm', quality,
    resolution: { loops, sections }, bounds: { minY: -p.width / 2, maxY: p.width / 2 },
    dimensions: { innerDiameter: p.innerDiameter, minRadialWall: p.thickness, axialSectionWidth: p.width },
    generationMs: performance.now() - started };
}

export const FACETED_FAMILY = {
  id: 'faceted', name: 'Ribbed & faceted', controls: FACETED_CONTROLS, presets: FACETED_PRESETS,
  normalize: normalizeFaceted, build: buildFaceted, serialize: serializeFaceted, parse: parseFaceted,
};
export default FACETED_FAMILY;
