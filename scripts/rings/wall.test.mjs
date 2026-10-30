import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { sampleWallThickness } from '../../modules/rings/wall.mjs';
import { buildWave, WAVE_PRESETS, WAVE_CONTROLS } from '../../modules/rings/wave.mjs';

const started = performance.now();
const evidence = { schemaVersion: 1, generatedAt: new Date().toISOString(), samplesPerMesh: 256,
  thresholdMm: 0.8, seed: '0xbb67ae85', cases: [], knownShapes: [],
  limitation: 'Inward normal chords at sampled vertices are not a continuous minimum thickness or nearest-surface guarantee. Incident triangles are excluded. Missed or backfacing first hits must not be treated as a pass.' };
after(async () => {
  evidence.elapsedMs = performance.now() - started;
  evidence.summary = { meshes: evidence.cases.length, rays: evidence.cases.reduce((n, c) => n + c.samplesTested, 0),
    minimumSampledWallMm: Math.min(...evidence.cases.map(c => c.sampledMinWallMm)),
    belowThreshold: evidence.cases.filter(c => c.sampledMinWallMm < evidence.thresholdMm).length,
    missedRays: evidence.cases.reduce((n, c) => n + c.missedRays, 0), backfacingHits: evidence.cases.reduce((n, c) => n + c.backfacingHits, 0),
    maximumElapsedMs: Math.max(...evidence.cases.map(c => c.elapsedMs)) };
  await mkdir('/workspace/ring-evidence', { recursive: true });
  await writeFile('/workspace/ring-evidence/wall.json', `${JSON.stringify(evidence, null, 2)}\n`);
});

function sphere(radius = 2, subdivisions = 3) {
  const vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  for (let level = 0; level < subdivisions; level++) {
    const cache = new Map(), next = [];
    const midpoint = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!cache.has(key)) {
        const p = vertices[a].map((v, k) => v + vertices[b][k]), length = Math.hypot(...p);
        cache.set(key, vertices.length); vertices.push(p.map(v => v / length));
      }
      return cache.get(key);
    };
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  return { positions: new Float32Array(vertices.flat().map(v => v * radius)), indices: new Uint32Array(faces.flat()), normals: new Float32Array(vertices.flat()) };
}

function torus() {
  const positions = [], normals = [], indices = [], loops = 64, sections = 32;
  for (let i = 0; i < loops; i++) for (let j = 0; j < sections; j++) {
    const u = i * 2 * Math.PI / loops, v = j * 2 * Math.PI / sections;
    positions.push((10 + 2 * Math.cos(v)) * Math.cos(u), 2 * Math.sin(v), (10 + 2 * Math.cos(v)) * Math.sin(u));
    normals.push(Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u));
    const a = i * sections + j, b = ((i + 1) % loops) * sections + j, c = ((i + 1) % loops) * sections + (j + 1) % sections, d = i * sections + (j + 1) % sections;
    indices.push(a, d, b, b, d, c);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), normals: new Float32Array(normals), resolution: { loops, sections } };
}

test('sphere rays recover its known 4 mm diameter at 256 distributed vertices', () => {
  const result = sampleWallThickness(sphere());
  assert.equal(result.samplesTested, 256);
  assert.equal(new Set(result.samples.map(s => s.vertexIndex)).size, 256);
  assert.equal(result.missedRays, 0); assert.equal(result.backfacingHits, 0);
  assert.ok(Math.abs(result.sampledMinWallMm - 4) < 2e-6);
  assert.ok(Math.abs(result.sampledMaxWallMm - 4) < 2e-6);
  evidence.knownShapes.push({ shape: 'sphere', expectedMm: 4, minimumMm: result.sampledMinWallMm, maximumMm: result.sampledMaxWallMm });
});

test('circular torus rays recover its known 4 mm minor diameter', () => {
  const result = sampleWallThickness(torus());
  assert.equal(result.samplesTested, 256); assert.equal(result.missedRays, 0); assert.equal(result.backfacingHits, 0);
  assert.ok(Math.abs(result.sampledMinWallMm - 4) < 5e-6);
  assert.ok(Math.abs(result.sampledMaxWallMm - 4) < 5e-6);
  const sections = new Set(result.samples.map(s => s.vertexIndex % 32));
  for (const cardinal of [0, 8, 16, 24]) assert.ok(sections.has(cardinal));
  assert.ok(new Set(result.samples.map(s => Math.floor(s.vertexIndex / 32))).size >= 24);
  evidence.knownShapes.push({ shape: 'torus', expectedMm: 4, minimumMm: result.sampledMinWallMm, maximumMm: result.sampledMaxWallMm });
});

test('normals are normalized and missing normals are derived without mutating the input', () => {
  const input = sphere(); input.normals = new Float32Array(Array.from(input.normals, v => v * 3));
  const first = input.normals[0], result = sampleWallThickness(input, { samples: 16 });
  assert.equal(input.normals[0], first); assert.ok(Math.abs(result.sampledMinWallMm - 4) < 2e-6);
  delete input.normals;
  const computed = sampleWallThickness(input, { samples: 64 });
  assert.equal(computed.normalsSource, 'computed-area-weighted');
  assert.equal(computed.missedRays, 0); assert.equal(computed.backfacingHits, 0);
  assert.ok(computed.sampledMinWallMm > 3.95 && computed.sampledMaxWallMm <= 4.00001);
});

test('open surface reports misses rather than an invented minimum wall', () => {
  const input = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) };
  const result = sampleWallThickness(input);
  assert.equal(result.samplesTested, 3); assert.equal(result.missedRays, 3);
  assert.equal(result.sampledMinWallMm, null); assert.equal(result.hits, 0);
});

test('first hit wins and inward-facing entry hits are explicitly flagged', () => {
  const outer = sphere(5, 1), inner = sphere(2, 1);
  const combined = { positions: new Float32Array([...outer.positions, ...inner.positions]), normals: new Float32Array([...outer.normals, ...inner.normals]),
    indices: new Uint32Array([...outer.indices, ...Array.from(inner.indices, v => v + outer.positions.length / 3)]) };
  const result = sampleWallThickness(combined, { samples: 6 });
  assert.equal(result.samplesTested, 6);
  assert.equal(result.missedRays, 0); assert.equal(result.backfacingHits, 6);
  assert.ok(Math.abs(result.sampledMinWallMm - 3) < 1e-6, 'nearest nested surface must precede far outer surface');
});

test('invalid geometry, normals, and sample counts fail explicitly', () => {
  for (const samples of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => sampleWallThickness(sphere(), { samples }), /positive integer/);
  const input = sphere(); input.normals[0] = NaN; assert.throws(() => sampleWallThickness(input), /finite and nonzero/);
  const bad = sphere(); bad.positions[0] = Infinity; assert.throws(() => sampleWallThickness(bad), /positions must be finite/);
  const index = sphere(); index.indices[0] = 999999; assert.throws(() => sampleWallThickness(index), /Invalid mesh index/);
});

function assess(name, params, quality) {
  const mesh = buildWave(params, quality), result = sampleWallThickness(mesh);
  evidence.cases.push({ name, quality, params: mesh.params, triangles: mesh.indices.length / 3,
    sampledMinWallMm: result.sampledMinWallMm, sampledMaxWallMm: result.sampledMaxWallMm,
    samplesTested: result.samplesTested, missedRays: result.missedRays, backfacingHits: result.backfacingHits,
    triangleTests: result.triangleTests, elapsedMs: result.elapsedMs,
    thinnestWitness: [...result.samples].filter(s => s.wallMm !== null).sort((a, b) => a.wallMm - b.wallMm)[0] });
  assert.equal(result.samplesTested, 256);
  assert.equal(result.missedRays, 0, `${name}/${quality} missed rays`);
  assert.equal(result.backfacingHits, 0, `${name}/${quality} backfacing hits`);
  assert.ok(result.sampledMinWallMm >= 0.8, `${name}/${quality}: sampled wall ${result.sampledMinWallMm} mm below 0.8 mm`);
  assert.ok(result.triangleTests < 256 * (mesh.indices.length / 3) / 20, 'BVH must reduce ray triangle workload');
}

for (const preset of WAVE_PRESETS) for (const quality of ['preview', 'settled', 'export']) test(`${preset.id}/${quality} sampled normal walls`, () => assess(preset.id, preset.params, quality));

const lower = Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.min]));
const upper = Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.max]));
const extremes = [
  ['all-lower', lower], ['all-upper', upper],
  ['small-bore-wide-high-wave', { ...upper, innerDiameter: 14 }],
  ['small-bore-thin-high-wave', { ...upper, innerDiameter: 14, width: 1.4, thickness: 1.2 }],
  ['small-bore-round-thin-high-wave', { ...upper, innerDiameter: 14, width: 1.4, thickness: 1.2, section: 0 }],
  ['small-bore-one-tall-wave', { ...upper, innerDiameter: 14, waves: 1, thickness: 1.2, width: 1.4 }],
];
for (const [name, params] of extremes) for (const quality of ['settled', 'export']) test(`${name}/${quality} sampled normal walls`, () => assess(name, params, quality));

test('30 seeded random settled meshes retain at least 0.8 mm sampled normal wall', () => {
  let state = 0xbb67ae85;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 30; i++) assess(`random-${i}`, Object.fromEntries(WAVE_CONTROLS.map(c => [c.key, c.min + random() * (c.max - c.min)])), 'settled');
});
