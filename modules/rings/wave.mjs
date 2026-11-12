/**
 * Continuous wave: direct indexed cross-section loops, following ring.js in
 * lxrogers/generative-rings-testing @ eee66e5d. No CSG/subdivision/noise.
 * Units: millimetres. Finger axis: Y. Right-handed, outward CCW triangles.
 */
export const WAVE_CONTROLS = [
  { key: 'innerDiameter', label: 'Inside diameter', min: 14, max: 24, step: 0.1, unit: 'mm', group: 'Fit & section' },
  { key: 'width', label: 'Band width', min: 1.4, max: 7, step: 0.1, unit: 'mm', group: 'Fit & section' },
  { key: 'thickness', label: 'Radial thickness', min: 1.2, max: 3.2, step: 0.05, unit: 'mm', group: 'Fit & section' },
  { key: 'section', label: 'Section shape', min: 0, max: 1, step: 0.01, unit: '', group: 'Fit & section' },
  { key: 'waves', label: 'Wave count', min: 1, max: 6, step: 1, unit: '', group: 'Wave' },
  { key: 'amplitude', label: 'Axial wave', min: 0, max: 2.8, step: 0.05, unit: 'mm', group: 'Wave' },
  { key: 'radial', label: 'Radial variation', min: 0, max: 2, step: 0.05, unit: 'mm', group: 'Wave' },
];

export const WAVE_PRESETS = [
  { id: 'tide', name: 'Tide', note: 'Broad, flowing, softly sculpted.', params: { innerDiameter: 17.8, width: 4.3, thickness: 1.65, section: 0.42, waves: 3, amplitude: 1.25, radial: 0.9 } },
  { id: 'ribbon', name: 'Ribbon', note: 'A fine architectural rhythm.', params: { innerDiameter: 17.8, width: 1.6, thickness: 1.35, section: 0.86, waves: 4, amplitude: 1.25, radial: 0.15 } },
  { id: 'swell', name: 'Swell', note: 'A generous, quiet contour.', params: { innerDiameter: 17.8, width: 5.3, thickness: 2.0, section: 0.22, waves: 2, amplitude: 0.95, radial: 1.15 } },
];
export const WAVE_DEFAULTS = WAVE_PRESETS[0].params;
export const MAX_TRIANGLES = 98304;

export function normalizeWave(input = {}) {
  const params = { ...WAVE_DEFAULTS }, adjustments = [];
  for (const c of WAVE_CONTROLS) {
    const raw = input[c.key] ?? WAVE_DEFAULTS[c.key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`${c.label} must be a finite number.`);
    const value = Number(Math.max(c.min, Math.min(c.max, c.min + Math.round((raw - c.min) / c.step) * c.step)).toFixed(4));
    params[c.key] = value;
    if (value !== raw) adjustments.push(`${c.label} limited to ${value}${c.unit ? ' ' + c.unit : ''}.`);
  }
  // Bound axial slope. Finger clearance never depends on the wave amplitude.
  // This also avoids highly compressed, steep narrow ribbons at small sizes.
  const amplitudeLimit = Math.min(2.8, 0.75 * params.innerDiameter / 2 / params.waves);
  if (params.amplitude > amplitudeLimit) {
    params.amplitude = Number((Math.floor(amplitudeLimit / 0.05) * 0.05).toFixed(2));
    adjustments.push(`Axial wave limited to ${params.amplitude.toFixed(2)} mm for this size and wave count.`);
  }
  return { params, adjustments };
}

export function serializeWave(input) {
  return JSON.stringify({ version: 1, family: 'wave', params: normalizeWave(input).params });
}

export function parseWave(text) {
  if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid ring parameters.');
  const data = JSON.parse(text);
  if (data.version !== 1 || data.family !== 'wave' || !data.params) throw new Error('Unsupported ring preset.');
  return normalizeWave(data.params);
}

export function waveResolution(params, quality = 'settled') {
  const density = quality === 'export' ? 96 : quality === 'preview' ? 24 : 48;
  const minimum = quality === 'export' ? 512 : quality === 'preview' ? 128 : 256;
  const loops = Math.ceil(Math.max(minimum, params.waves * density) / 4) * 4;
  const sections = quality === 'export' ? 64 : quality === 'preview' ? 24 : 40;
  return { loops, sections };
}

export function buildWave(input, quality = 'settled') {
  if (!['preview', 'settled', 'export'].includes(quality)) throw new Error('Unknown mesh quality.');
  const started = performance.now();
  const { params: p, adjustments } = normalizeWave(input);
  const { loops, sections } = waveResolution(p, quality);
  const triangleCount = 2 * loops * sections;
  if (triangleCount > MAX_TRIANGLES) throw new Error('Mesh budget exceeded.');
  const positions = new Float32Array(loops * sections * 3);
  const indices = new Uint32Array(triangleCount * 3);
  const normals = new Float32Array(positions.length);
  // Chords dip inside the vertex cylinder: compensate for the facet apothem,
  // with a 2 micron margin for Float32/STL rounding. This bounds ALL triangles.
  const innerRadius = (p.innerDiameter / 2 + 0.002) / Math.cos(Math.PI / loops);
  const exponent = 2 + p.section * 6;
  const section = Array.from({ length: sections }, (_, j) => {
    const phi = j / sections * Math.PI * 2, c = Math.cos(phi), s = Math.sin(phi);
    const f = Math.pow(Math.abs(c) ** exponent + Math.abs(s) ** exponent, -1 / exponent);
    return [c * f, s * f];
  });
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < loops; i++) {
    const theta = i / loops * Math.PI * 2;
    const axial = p.amplitude * Math.sin(p.waves * theta);
    const thickness = p.thickness + p.radial * (0.5 + 0.5 * Math.sin(p.waves * theta + 0.7));
    for (let j = 0; j < sections; j++) {
      const [u, v] = section[j];
      const r = innerRadius + thickness * (u + 1) / 2;
      const y = axial + p.width * v / 2;
      const at = (i * sections + j) * 3;
      positions[at] = r * Math.cos(theta);
      positions[at + 1] = y;
      positions[at + 2] = r * Math.sin(theta);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const a = i * sections + j, b = ((i + 1) % loops) * sections + j;
      const c = ((i + 1) % loops) * sections + (j + 1) % sections, d = i * sections + (j + 1) % sections;
      const k = (i * sections + j) * 6;
      indices.set([a, d, b, b, d, c], k);
    }
  }
  for (let k = 0; k < indices.length; k += 3) {
    const a = indices[k] * 3, b = indices[k + 1] * 3, c = indices[k + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const n of [a, b, c]) { normals[n] += nx; normals[n + 1] += ny; normals[n + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  return {
    positions, indices, normals, params: p, adjustments, family: 'wave', units: 'mm', quality,
    resolution: { loops, sections }, bounds: { minY, maxY },
    dimensions: { innerDiameter: p.innerDiameter, minRadialWall: p.thickness, axialSectionWidth: p.width },
    generationMs: performance.now() - started,
  };
}
