import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildWave, normalizeWave, waveResolution, serializeWave, parseWave, WAVE_CONTROLS, WAVE_PRESETS, WAVE_DEFAULTS, MAX_TRIANGLES } from '../../modules/rings/wave.mjs';
import { validateMesh } from '../../modules/rings/validate.mjs';
import { meshToSTL } from '../../modules/rings/stl.mjs';

// Run: node --expose-gc --test scripts/rings/check-wave.test.mjs
const started = performance.now();
const evidence = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), node: process.version,
  command: 'node --expose-gc --test scripts/rings/check-wave.test.mjs',
  seed: '0x6a09e667', meshChecks: [], stlChecks: [], normalization: {}, previewStress: null,
  limitations: [
    'Radial wall is independently measured between inner and outer vertices at each axial section center. It is not a true shortest 3D wall thickness certification.',
    'Intersection checks exclude triangles sharing a vertex; local incident-face foldovers are not certified.',
    'Node preview stress drops typed-array references and forces garbage collection; GPU disposal and browser interaction are separate checks.',
    'No image reference comparison was performed.',
  ],
};
after(async () => {
  evidence.elapsedMs = performance.now() - started;
  evidence.summary = {
    meshes: evidence.meshChecks.length, stlRoundTrips: evidence.stlChecks.length,
    invalidMeshes: evidence.meshChecks.filter(r => !r.valid).length,
    maximumTriangles: Math.max(0, ...evidence.meshChecks.map(r => r.triangleCount)), triangleCap: MAX_TRIANGLES,
    minimumClearanceMarginMm: Math.min(...evidence.meshChecks.map(r => r.clearanceMarginMm)),
    totalIntersectionTests: evidence.meshChecks.reduce((sum, r) => sum + r.intersectionTests, 0),
    randomSettledMeshes: evidence.meshChecks.filter(r => r.name.startsWith('random-')).length,
  };
  await mkdir('/workspace/ring-evidence', { recursive: true });
  await writeFile('/workspace/ring-evidence/geometry.json', `${JSON.stringify(evidence, null, 2)}\n`);
});

function expectedCounts(params, quality) {
  const around = Math.ceil(Math.max(quality === 'export' ? 512 : quality === 'preview' ? 128 : 256,
    params.waves * (quality === 'export' ? 96 : quality === 'preview' ? 24 : 48)) / 4) * 4;
  const section = quality === 'export' ? 64 : quality === 'preview' ? 24 : 40;
  return { loops: around, sections: section, vertices: around * section, triangles: around * section * 2 };
}

function measureSections(mesh) {
  const { positions: p, resolution: { loops, sections }, params } = mesh;
  let minimumWall = Infinity, maximumWall = -Infinity, maximumWidthError = 0, maximumCenterError = 0;
  for (let i = 0; i < loops; i++) {
    const outer = i * sections * 3, inner = (i * sections + sections / 2) * 3;
    const wall = Math.hypot(p[outer], p[outer + 2]) - Math.hypot(p[inner], p[inner + 2]);
    minimumWall = Math.min(minimumWall, wall); maximumWall = Math.max(maximumWall, wall);
    maximumCenterError = Math.max(maximumCenterError, Math.abs(p[outer + 1] - p[inner + 1]));
    const top = (i * sections + sections / 4) * 3 + 1, bottom = (i * sections + 3 * sections / 4) * 3 + 1;
    maximumWidthError = Math.max(maximumWidthError, Math.abs(p[top] - p[bottom] - params.width));
  }
  assert.ok(maximumCenterError < 2e-6, `axial section center error ${maximumCenterError}`);
  assert.ok(maximumWidthError < 2e-6, `width error ${maximumWidthError}`);
  assert.ok(minimumWall >= params.thickness - 3e-6, `radial wall ${minimumWall} < ${params.thickness}`);
  assert.ok(maximumWall <= params.thickness + params.radial + 3e-6);
  const angularSamplingError = params.radial * (1 - Math.cos(params.waves * Math.PI / loops)) / 2;
  assert.ok(minimumWall <= params.thickness + angularSamplingError + 3e-6);
  assert.ok(maximumWall >= params.thickness + params.radial - angularSamplingError - 3e-6);
  assert.equal(mesh.dimensions.minRadialWall, params.thickness);
  assert.equal(mesh.dimensions.axialSectionWidth, params.width);
  return { minimumWall, maximumWall, maximumWidthError, maximumCenterError };
}

function checkMesh(name, input, quality) {
  const mesh = buildWave(input, quality), expected = expectedCounts(mesh.params, quality);
  assert.deepEqual(mesh.resolution, { loops: expected.loops, sections: expected.sections });
  assert.deepEqual(waveResolution(mesh.params, quality), mesh.resolution);
  assert.ok(mesh.positions instanceof Float32Array && mesh.normals instanceof Float32Array && mesh.indices instanceof Uint32Array);
  assert.equal(mesh.positions.length, expected.vertices * 3);
  assert.equal(mesh.normals.length, expected.vertices * 3);
  assert.equal(mesh.indices.length, expected.triangles * 3);
  assert.ok(expected.triangles <= MAX_TRIANGLES);
  const checkStarted = performance.now();
  const report = validateMesh(mesh, { minInnerRadius: mesh.params.innerDiameter / 2 });
  const result = {
    name, quality, params: mesh.params, adjustments: mesh.adjustments, valid: report.valid, errors: report.errors,
    vertexCount: report.vertexCount, triangleCount: report.triangleCount,
    generationMs: mesh.generationMs, validationMs: performance.now() - checkStarted,
    minInnerRadius: report.minInnerRadius, clearanceMarginMm: report.minInnerRadius - mesh.params.innerDiameter / 2,
    volumeMm3: report.volumeMm3, bounds: report.bounds,
    components: report.components, boundaryEdges: report.boundaryEdges, nonmanifoldEdges: report.nonmanifoldEdges,
    windingErrors: report.windingErrors, invalidNormals: report.invalidNormals, degenerateTriangles: report.degenerateTriangles,
    intersectionPairs: report.intersectionPairs, intersectionTests: report.intersectionTests,
  };
  evidence.meshChecks.push(result);
  assert.equal(report.valid, true, `${name}/${quality}: ${report.errors.join('; ')}`);
  assert.equal(report.components, 1);
  assert.equal(report.boundaryEdges + report.nonmanifoldEdges + report.windingErrors, 0, 'periodic closure');
  assert.equal(report.invalidNormals, 0);
  assert.equal(report.intersectionPairs, 0);
  assert.equal(report.intersectionCheckPerformed, true);
  assert.equal(report.intersectionsCapped, false);
  assert.ok(report.minInnerRadius >= mesh.params.innerDiameter / 2);
  assert.ok(report.volumeMm3 > 0);
  assert.equal(mesh.units, 'mm');
  assert.ok(Math.abs(mesh.bounds.minY - report.bounds.min[1]) < 2e-6);
  assert.ok(Math.abs(mesh.bounds.maxY - report.bounds.max[1]) < 2e-6);
  result.radialSection = measureSections(mesh);
  return { mesh, report };
}

function readAndWeldSTL(buffer) {
  const view = new DataView(buffer), count = view.getUint32(80, true);
  assert.equal(buffer.byteLength, 84 + count * 50);
  const vertices = [], indices = [], keys = new Map();
  let maximumFacetNormalError = 0;
  for (let triangle = 0; triangle < count; triangle++) {
    const start = 84 + triangle * 50;
    const face = [];
    for (let vertex = 0; vertex < 3; vertex++) {
      const at = start + 12 + vertex * 12;
      // Exact stored Float32 bit triples: no rounding/quantization tolerance.
      const key = [0, 4, 8].map(k => view.getUint32(at + k, true)).join(':');
      if (!keys.has(key)) {
        keys.set(key, vertices.length / 3);
        for (let k = 0; k < 12; k += 4) vertices.push(view.getFloat32(at + k, true));
      }
      const id = keys.get(key); indices.push(id); face.push(vertices.slice(id * 3, id * 3 + 3));
    }
    const u = face[1].map((v, k) => v - face[0][k]), w = face[2].map((v, k) => v - face[0][k]);
    const normal = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const length = Math.hypot(...normal); assert.ok(length > 0 && Number.isFinite(length));
    for (let k = 0; k < 3; k++) maximumFacetNormalError = Math.max(maximumFacetNormalError, Math.abs(view.getFloat32(start + k * 4, true) - normal[k] / length));
    assert.equal(view.getUint16(start + 48, true), 0);
  }
  const normals = new Float64Array(vertices.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
    for (const at of [a, b, c]) { normals[at] += uy * vz - uz * vy; normals[at + 1] += uz * vx - ux * vz; normals[at + 2] += ux * vy - uy * vx; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    for (let k = 0; k < 3; k++) normals[i + k] /= length;
  }
  return { mesh: { positions: new Float32Array(vertices), indices: new Uint32Array(indices), normals: new Float32Array(normals) }, maximumFacetNormalError };
}

function checkSTL(name, source, sourceReport) {
  const buffer = meshToSTL(source), { mesh, maximumFacetNormalError } = readAndWeldSTL(buffer);
  const report = validateMesh(mesh, { minInnerRadius: source.params.innerDiameter / 2 });
  const result = { name, bytes: buffer.byteLength, triangleCount: report.triangleCount, weldedVertexCount: report.vertexCount, valid: report.valid, errors: report.errors,
    maximumFacetNormalError, volumeMm3: report.volumeMm3, minInnerRadius: report.minInnerRadius, bounds: report.bounds, intersectionPairs: report.intersectionPairs };
  evidence.stlChecks.push(result);
  assert.equal(report.valid, true, `${name} STL: ${report.errors.join('; ')}`);
  assert.equal(report.vertexCount, sourceReport.vertexCount);
  assert.equal(report.triangleCount, sourceReport.triangleCount);
  assert.equal(report.volumeMm3, sourceReport.volumeMm3);
  assert.equal(report.minInnerRadius, sourceReport.minInnerRadius);
  assert.deepEqual(report.bounds, sourceReport.bounds, 'export retains exact mm dimensions');
  assert.ok(maximumFacetNormalError < 1e-7);
  for (let i = 0; i < mesh.indices.length; i++) for (let k = 0; k < 3; k++) {
    assert.equal(mesh.positions[mesh.indices[i] * 3 + k], source.positions[source.indices[i] * 3 + k], 'STL coordinates exactly match original Float32');
  }
}

for (const preset of WAVE_PRESETS) for (const quality of ['preview', 'settled', 'export']) {
  test(`${preset.id}: ${quality} geometry${quality === 'export' ? ' and STL round trip' : ''}`, () => {
    const { mesh, report } = checkMesh(`preset-${preset.id}`, preset.params, quality);
    if (quality === 'export') checkSTL(`preset-${preset.id}`, mesh, report);
  });
}

const lower = Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.min]));
const upper = Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.max]));
const extremes = [
  ['all-lower', lower], ['all-upper', upper],
  ['small-bore-wide-high-wave', { ...upper, innerDiameter: 14 }],
  ['small-bore-thin-high-wave', { ...upper, innerDiameter: 14, width: 1.4, thickness: 1.2 }],
  ['small-bore-round-high-wave', { ...upper, innerDiameter: 14, section: 0 }],
  ['small-bore-one-tall-wave', { ...upper, innerDiameter: 14, waves: 1 }],
];
for (const [name, params] of extremes) for (const quality of ['preview', 'settled', 'export']) {
  test(`${name}: ${quality} geometry${quality === 'export' ? ' and STL round trip' : ''}`, () => {
    const { mesh, report } = checkMesh(name, params, quality);
    if (quality === 'export') checkSTL(name, mesh, report);
  });
}

test('100 seeded random settled parameter combinations', () => {
  let state = 0x6a09e667;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 100; i++) {
    const params = Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.min + random() * (c.max - c.min)]));
    checkMesh(`random-${String(i).padStart(3, '0')}`, params, 'settled');
  }
});

test('normalization rejects invalid numbers, clamps ranges and rounds counts', () => {
  let rejectedValues = 0;
  for (const c of WAVE_CONTROLS) for (const invalid of [NaN, Infinity, -Infinity, '2', true, {}, []]) {
    assert.throws(() => normalizeWave({ [c.key]: invalid }), /finite number/); rejectedValues++;
  }
  assert.deepEqual(normalizeWave({}).params, WAVE_DEFAULTS);
  assert.deepEqual(normalizeWave(Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, null]))).params, WAVE_DEFAULTS, 'null uses defaults');
  const below = normalizeWave(Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.min - 100])));
  assert.deepEqual(below.params, lower);
  assert.equal(below.adjustments.length, WAVE_CONTROLS.length);
  const above = normalizeWave(Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.max + 100])));
  for (const c of WAVE_CONTROLS) {
    assert.ok(above.params[c.key] >= c.min && above.params[c.key] <= c.max);
    if (c.key !== 'amplitude') assert.equal(above.params[c.key], c.max);
  }
  for (const [input, expected] of [[-10, 1], [1.49, 1], [1.5, 2], [5.49, 5], [5.5, 6], [99, 6]]) assert.equal(normalizeWave({ waves: input }).params.waves, expected);
  const slope = normalizeWave({ innerDiameter: 14, waves: 6, amplitude: 2.8 });
  assert.equal(slope.params.amplitude, 0.85);
  assert.ok(slope.adjustments.some(s => s.includes('size and wave count')));
  assert.deepEqual(normalizeWave(slope.params), { params: slope.params, adjustments: [] });
  assert.throws(() => buildWave({}, 'unknown'), /quality/);
  assert.deepEqual(parseWave(serializeWave(upper)).params, normalizeWave(upper).params);
  for (const bad of ['not json', '{}', '{"version":2,"family":"wave","params":{}}', '{"version":1,"family":"other","params":{}}', ' '.repeat(2049), null]) assert.throws(() => parseWave(bad));
  for (let waves = 1; waves <= 6; waves++) for (const quality of ['preview', 'settled', 'export']) {
    const counts = expectedCounts({ waves }, quality);
    assert.equal(counts.loops % 4, 0); assert.equal(counts.sections % 4, 0);
    assert.ok(counts.triangles <= MAX_TRIANGLES);
  }
  evidence.normalization = { passed: true, invalidValuesRejected: rejectedValues, nullUsesDefaults: true, countRounding: 'Math.round then range clamp', slopeLimitedAmplitudeMm: slope.params.amplitude,
    maximumPermittedExportTriangles: expectedCounts({ waves: 6 }, 'export').triangles };
});

test('1000 preview generations release their typed arrays and stay within bounded Node memory', () => {
  const timings = [], snapshots = [], hasGC = typeof global.gc === 'function';
  // Warm up V8/JIT before measuring retained memory.
  for (let i = 0; i < 30; i++) buildWave(WAVE_DEFAULTS, 'preview');
  const sample = iteration => {
    if (hasGC) { global.gc(); global.gc(); }
    const usage = process.memoryUsage();
    snapshots.push({ iteration, heapUsed: usage.heapUsed, arrayBuffers: usage.arrayBuffers, external: usage.external, rss: usage.rss });
  };
  sample(0);
  const begin = performance.now();
  for (let i = 0; i < 1000; i++) {
    const input = { ...WAVE_PRESETS[i % WAVE_PRESETS.length].params, waves: 1 + (i % 6), amplitude: (i % 57) * 0.05 };
    const start = performance.now(); let mesh = buildWave(input, 'preview');
    timings.push(performance.now() - start);
    assert.equal(mesh.positions.length, expectedCounts(mesh.params, 'preview').vertices * 3);
    assert.ok(Number.isFinite(mesh.normals[0]));
    mesh = null;
    if ((i + 1) % 100 === 0) sample(i + 1);
  }
  timings.sort((a, b) => a - b);
  const first = snapshots[0], last = snapshots.at(-1);
  evidence.previewStress = { iterations: 1000, gcAvailable: hasGC, elapsedMs: performance.now() - begin,
    medianGenerationMs: timings[500], p95GenerationMs: timings[950], maxGenerationMs: timings[999], snapshots,
    retainedHeapDeltaBytes: last.heapUsed - first.heapUsed, retainedArrayBufferDeltaBytes: last.arrayBuffers - first.arrayBuffers };
  if (hasGC) {
    assert.ok(last.heapUsed - first.heapUsed < 16 * 1024 * 1024, 'retained heap must remain under 16 MiB growth');
    assert.ok(last.arrayBuffers - first.arrayBuffers < 2 * 1024 * 1024, 'retained typed arrays must remain under 2 MiB growth');
    assert.ok(Math.max(...snapshots.map(s => s.heapUsed)) - first.heapUsed < 24 * 1024 * 1024, 'post-GC heap remains bounded throughout');
    assert.ok(Math.max(...snapshots.map(s => s.arrayBuffers)) - first.arrayBuffers < 2 * 1024 * 1024, 'post-GC buffers remain bounded throughout');
  }
});
