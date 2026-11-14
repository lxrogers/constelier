import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  LIQUID_ACCENT_FAMILY as family, LIQUID_ACCENT_CONTROLS as controls,
  LIQUID_ACCENT_PRESETS as presets, LIQUID_ACCENT_DEFAULTS as defaults,
  LIQUID_ACCENT_MAX_TRIANGLES, buildLiquidAccent as build,
  normalizeLiquidAccent as normalize, liquidAccentSection as section,
  validateLiquidAccentConstruction as construction,
} from '../../modules/rings/liquid-accent.mjs';
import { validateMesh } from '../../modules/rings/validate.mjs';
import { sampleWallThickness } from '../../modules/rings/wall.mjs';
import { meshToSTL } from '../../modules/rings/stl.mjs';

// No dependencies beyond Node. Optional evidence destination is outside the repo.
// node --expose-gc --test scripts/rings/liquid-accent.test.mjs
const evidence = { seed: '0x1a11ce', node: process.version, generatedAt: new Date().toISOString(),
  meshes: [], corners: 0, stl: [], timings: [], stress: null };
after(async () => {
  evidence.summary = {
    meshChecks: evidence.meshes.length, cornerConstructions: evidence.corners,
    invalid: evidence.meshes.filter(x => !x.valid).length,
    minimumBoreMarginMm: Math.min(...evidence.meshes.map(x => x.boreMarginMm)),
    minimumSampledChordMm: Math.min(...evidence.meshes.map(x => x.sampledWallMm ?? Infinity)),
    wallRays: evidence.meshes.reduce((n, x) => n + (x.wallRays ?? 0), 0),
    maxTriangles: Math.max(...evidence.meshes.map(x => x.triangles)),
    note: 'Shared base validator skips incident faces; the family graph invariant separately covers local foldovers. Wall rays are sampled diagnostics, not casting certification.',
  };
  if (process.env.LIQUID_EVIDENCE) {
    await mkdir(process.env.LIQUID_EVIDENCE, { recursive: true });
    await writeFile(`${process.env.LIQUID_EVIDENCE}/geometry.json`, JSON.stringify(evidence, null, 2) + '\n');
  }
});

function check(name, params, quality = 'settled', wall = quality !== 'preview') {
  const mesh = build(params, quality), start = performance.now();
  assert.equal(construction(mesh).valid, true);
  const v = validateMesh(mesh, { minInnerRadius: mesh.params.innerDiameter / 2 });
  const validationMs = performance.now() - start;
  const w = wall ? sampleWallThickness(mesh) : null;
  evidence.meshes.push({ name, quality, params: mesh.params, valid: v.valid, errors: v.errors,
    triangles: v.triangleCount, vertices: v.vertexCount, generationMs: mesh.generationMs, validationMs,
    boreMarginMm: v.minInnerRadius - mesh.params.innerDiameter / 2, volumeMm3: v.volumeMm3,
    intersections: v.intersectionPairs, intersectionTests: v.intersectionTests,
    boundaryEdges: v.boundaryEdges, nonmanifoldEdges: v.nonmanifoldEdges, windingErrors: v.windingErrors,
    degenerateTriangles: v.degenerateTriangles, sampledWallMm: w?.sampledMinWallMm,
    wallRays: w?.samplesTested, missedRays: w?.missedRays, backfacingHits: w?.backfacingHits });
  assert.equal(v.valid, true, `${name}: ${v.errors.join('; ')}`);
  assert.equal(v.components, 1);
  assert.equal(v.boundaryEdges + v.nonmanifoldEdges + v.windingErrors + v.degenerateTriangles + v.intersectionPairs, 0);
  assert(v.minInnerRadius >= mesh.params.innerDiameter / 2 + 0.00199);
  assert(mesh.indices.length / 3 <= LIQUID_ACCENT_MAX_TRIANGLES);
  assert(mesh.positions instanceof Float32Array && mesh.normals instanceof Float32Array && mesh.indices instanceof Uint32Array);
  assert.equal(mesh.units, 'mm'); assert.equal(mesh.family, family.id);
  if (w) {
    assert.equal(w.missedRays + w.backfacingHits, 0, name);
    assert(w.sampledMinWallMm >= 0.8, `${name}: sampled wall ${w.sampledMinWallMm}`);
  }
  return mesh;
}

function roundTrip(mesh) {
  const buffer = meshToSTL(mesh), view = new DataView(buffer), positions = [], indices = [], seen = new Map();
  const triangles = view.getUint32(80, true);
  assert.equal(buffer.byteLength, 84 + 50 * triangles);
  for (let t = 0; t < triangles; t++) for (let j = 0; j < 3; j++) {
    const at = 84 + t * 50 + 12 + j * 12;
    const key = [0, 4, 8].map(k => view.getUint32(at + k, true)).join(':');
    if (!seen.has(key)) { seen.set(key, positions.length / 3); positions.push(...[0, 4, 8].map(k => view.getFloat32(at + k, true))); }
    indices.push(seen.get(key));
    for (let k = 0; k < 3; k++) assert.equal(view.getFloat32(at + k * 4, true), mesh.positions[mesh.indices[t * 3 + j] * 3 + k]);
  }
  const report = validateMesh({ positions: Float32Array.from(positions), indices: Uint32Array.from(indices) }, { minInnerRadius: mesh.params.innerDiameter / 2 });
  assert.equal(report.valid, true, report.errors.join('; '));
  assert.equal(report.vertexCount, mesh.positions.length / 3);
  evidence.stl.push({ name: mesh.params, triangles, bytes: buffer.byteLength, valid: report.valid });
}

for (const p of presets) for (const quality of ['preview', 'settled', 'export']) test(`${p.name} / ${quality}`, () => {
  const mesh = check(p.id, p.params, quality);
  if (quality === 'export') roundTrip(mesh);
});

const lower = Object.fromEntries(controls.map(c => [c.key, c.min]));
const upper = Object.fromEntries(controls.map(c => [c.key, c.max]));
const extrema = [
  ['all-minimum', lower], ['all-maximum', upper],
  ['narrow-deep-tilted', { ...upper, innerDiameter: 14, width: 1.6, thickness: 1.2, accentWidth: 1.6, span: 80 }],
  ['wide-thin-shoulders', { ...upper, innerDiameter: 14, width: 1.6, thickness: 1.2, span: 80 }],
  ['reverse-pinched-crest', { ...upper, innerDiameter: 14, thickness: 1.2, accentWidth: 1.6, span: 80, asymmetry: -0.8 }],
  ['flat-degenerate-controls', { ...lower, amplitude: 0, radial: 0, gloopiness: 0, accentWidth: 1.6 }],
  ['thin-steep-regression', { innerDiameter: 14, width: 1.6, thickness: 1.2, span: 94, amplitude: 3.2, asymmetry: -0.62, accentWidth: 4.8, radial: 0, gloopiness: 0.04 }],
];
for (const [name, params] of extrema) for (const quality of ['preview', 'settled', 'export']) test(`${name} / ${quality}`, () => check(name, params, quality));

test('all 512 parameter-box corners retain the graph invariant, closure and declared bore', () => {
  for (let mask = 0; mask < 2 ** controls.length; mask++) {
    const p = Object.fromEntries(controls.map((c, k) => [c.key, mask & (1 << k) ? c.max : c.min]));
    const m = build(p, 'preview');
    assert.equal(construction(m).valid, true, `corner ${mask}`);
    const v = validateMesh(m, { intersections: false, minInnerRadius: m.params.innerDiameter / 2 });
    assert.equal(v.valid, true, `corner ${mask}: ${v.errors}`);
    evidence.corners++;
  }
});

test('100 deterministic randomized settled meshes, including 30 thin/small-bore strong accents', () => {
  let state = 0x1a11ce;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 100; i++) {
    const p = Object.fromEntries(controls.map(c => [c.key, c.min + random() * (c.max - c.min)]));
    if (i < 30) Object.assign(p, { innerDiameter: 14, width: 1.6, thickness: 1.2, amplitude: 3.2 });
    check(`seeded-${i}`, p);
  }
});

test('local construction catches incident foldovers, projection drift, swapped diagonals and collapsed stations', () => {
  const alter = mutate => { const m = build(presets[1].params, 'preview'); mutate(m); assert.equal(construction(m).valid, false); };
  alter(m => { const s = m.resolution.sections, i = 32, j = 5; m.positions[(i * s + j) * 3 + 1] = m.positions[(i * s + s - j) * 3 + 1] - 0.1; });
  alter(m => { m.positions[3] += 0.01; });
  // The regular sweep's diagonal on the lower half is topologically legal but
  // breaks the matched graph proof. This family must reject it explicitly.
  alter(m => { const s = m.resolution.sections, j = s / 2, a = j, b = s + j, c = b + 1, d = a + 1; m.indices.set([a, d, b, b, d, c], j * 6); });
  alter(m => { m.positions.copyWithin(3, 0, 3); });
  alter(m => { m.positions[0] = NaN; });
  alter(m => { m.indices[0] = m.indices[1]; });
});

test('normalization, exact UI steps, malformed imports, versions and deterministic transfer', () => {
  assert.deepEqual(normalize().params, defaults);
  for (const c of controls) for (const invalid of [NaN, Infinity, -Infinity, null, '2', true, {}, []]) assert.throws(() => normalize({ [c.key]: invalid }));
  for (const invalid of [null, 'bad', 1, []]) assert.throws(() => normalize(invalid));
  for (const p of [upper, lower, ...extrema.map(x => x[1])]) {
    const n = normalize(p);
    assert.deepEqual(normalize(n.params), { params: n.params, adjustments: [] });
    for (const c of controls) {
      assert(n.params[c.key] >= c.min && n.params[c.key] <= c.max);
      const ticks = (n.params[c.key] - c.min) / c.step;
      assert(Math.abs(ticks - Math.round(ticks)) < 1e-8, `${c.key} aligned with UI`);
    }
    assert.deepEqual(family.parse(family.serialize(p)).params, n.params);
  }
  for (const bad of ['not json', 'null', '{}', '{"version":2,"family":"liquid-accent","params":{}}', '{"version":1,"family":"wave","params":{}}', '{"version":1,"family":"liquid-accent","params":[]}', ' '.repeat(2049)]) assert.throws(() => family.parse(bad));
  assert.throws(() => build({}, 'infinite'), /quality/);
  const m = build(defaults, 'preview'), same = build(defaults, 'preview');
  assert.deepEqual(m.positions, same.positions); assert.deepEqual(m.indices, same.indices); assert.deepEqual(m.normals, same.normals);
  const copy = structuredClone(m, { transfer: [m.positions.buffer, m.normals.buffer, m.indices.buffer] });
  assert.equal(m.positions.byteLength, 0); assert.equal(construction(copy).valid, true);
});

test('lower shank is exactly quiet; accent is periodic and C2 at its shoulders', () => {
  const p = presets[1].params, half = p.span * Math.PI / 360;
  for (const theta of [0, Math.PI, Math.PI * 1.5, Math.PI * 2]) {
    const s = section(p, theta); assert.equal(s.center, 0); assert.equal(s.width, p.width); assert.equal(s.thickness, p.thickness);
  }
  for (const theta of [0, 0.5, 1.5, 2.4, 5]) {
    const a = section(p, theta), b = section(p, theta + Math.PI * 2);
    for (const k of Object.keys(a)) assert(Math.abs(a[k] - b[k]) < 1e-12);
  }
  for (const sign of [-1, 1]) {
    const edge = Math.PI / 2 + sign * half, h = 1e-5;
    const outside = section(p, edge + sign * h), inside = section(p, edge - sign * h);
    for (const k of ['center', 'width', 'thickness']) assert(Math.abs(outside[k] - inside[k]) / (h * h) < 0.03, `${k}: no hard shoulder`);
  }
});

test('dials independently move centerline, width and radial thickness while keeping the bore', () => {
  const p = presets[1].params, angles = Array.from({ length: 81 }, (_, i) => i * Math.PI / 40);
  for (const [key, value, unchanged] of [['amplitude', 0, ['width', 'thickness']], ['accentWidth', 3, ['center', 'thickness']], ['radial', 0, ['center', 'width']]]) {
    let changes = 0;
    for (const a of angles) {
      const before = section(p, a), after = section({ ...p, [key]: value }, a);
      for (const k of unchanged) assert.equal(before[k], after[k]);
      changes += JSON.stringify(before) !== JSON.stringify(after);
    }
    assert(changes > 10, key);
  }
  const base = build(p, 'preview');
  for (const c of controls) {
    const other = build({ ...p, [c.key]: p[c.key] === c.max ? c.min : c.max }, 'preview');
    assert.notDeepEqual(base.positions, other.positions, `${c.label} changes mesh`);
  }
});

test('generation and validation timing: default and worst geometry at each quality', () => {
  for (const [name, p] of [['flicker', defaults], ['maximum-budget', extrema[2][1]]]) for (const quality of ['preview', 'settled', 'export']) {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now(), m = build(p, quality);
      const v = validateMesh(m, { minInnerRadius: m.params.innerDiameter / 2, intersections: quality !== 'preview' });
      assert(v.valid);
      if (quality !== 'preview') {
        const w = sampleWallThickness(m); assert(w.sampledMinWallMm >= 0.8 && !w.missedRays && !w.backfacingHits);
      }
      runs.push({ generationMs: m.generationMs, totalMs: performance.now() - start, triangles: m.indices.length / 3 });
    }
    evidence.timings.push({ name, quality, medianGenerationMs: runs.map(x => x.generationMs).sort((a, b) => a - b)[2], medianTotalMs: runs.map(x => x.totalMs).sort((a, b) => a - b)[2], runs });
  }
});

test('1000 sustained preview generations retain bounded memory and a fixed mesh budget', () => {
  for (let i = 0; i < 30; i++) build(defaults, 'preview');
  const gc = () => { global.gc?.(); global.gc?.(); return process.memoryUsage(); };
  const before = gc(), durations = [];
  for (let i = 0; i < 1000; i++) {
    const m = build({ ...presets[i % 3].params, amplitude: i % 65 * 0.05, asymmetry: (i % 81 - 40) * 0.02, span: 80 + i % 91 }, 'preview');
    durations.push(m.generationMs); assert(m.indices.length / 3 <= 6912);
  }
  const after = gc(); durations.sort((a, b) => a - b);
  evidence.stress = { iterations: 1000, gcAvailable: !!global.gc, medianMs: durations[500], p95Ms: durations[950], maxMs: durations[999], before, after };
  if (global.gc) {
    assert(after.arrayBuffers - before.arrayBuffers < 1024 * 1024);
    assert(after.heapUsed - before.heapUsed < 16 * 1024 * 1024);
  }
});
