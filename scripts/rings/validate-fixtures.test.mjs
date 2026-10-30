import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMesh } from '../../modules/rings/validate.mjs';

const mesh = (positions, indices, normals) => ({ positions: new Float32Array(positions.flat()), indices: new Uint32Array(indices.flat()), ...(normals ? { normals: new Float32Array(normals.flat()) } : {}) });
const trianglePair = (a, b) => mesh([...a, ...b], [0, 1, 2, 3, 4, 5]);
const tetrahedron = (offset = [0, 0, 0]) => mesh([[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 2]].map(p => p.map((v, k) => v + offset[k])), [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
function combine(a, b) { return mesh([...a.positions, ...b.positions], [...a.indices, ...Array.from(b.indices, i => i + a.positions.length / 3)]); }

function torus(around = 24, section = 12) {
  const p = [], n = [], indices = [], major = 10, minor = 2;
  for (let i = 0; i < around; i++) for (let j = 0; j < section; j++) {
    const u = i * Math.PI * 2 / around, v = j * Math.PI * 2 / section;
    p.push((major + minor * Math.cos(v)) * Math.cos(u), minor * Math.sin(v), (major + minor * Math.cos(v)) * Math.sin(u));
    n.push(Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u));
    const a = i * section + j, b = ((i + 1) % around) * section + j;
    const c = ((i + 1) % around) * section + (j + 1) % section, d = i * section + (j + 1) % section;
    indices.push(a, d, b, b, d, c);
  }
  return mesh(p, indices, n);
}

test('a small torus is one outward, watertight, intersection-free surface', () => {
  const report = validateMesh(torus(), { minInnerRadius: 7.9 });
  assert.equal(report.valid, true, report.errors.join('\n'));
  assert.equal(report.components, 1);
  assert.equal(report.intersectionPairs, 0);
  assert.equal(report.intersectionCheckPerformed, true);
  assert.ok(report.intersectionTests > 0);
  assert.ok(Math.abs(report.volumeMm3 - 2 * Math.PI ** 2 * 10 * 4) / (2 * Math.PI ** 2 * 10 * 4) < 0.07);
  assert.ok(Math.abs(report.minInnerRadius - 8 * Math.cos(Math.PI / 24)) < 1e-5);
});

test('crossing noncoplanar triangles are detected', () => {
  const report = validateMesh(trianglePair([[-1, 0, -1], [1, 0, -1], [0, 0, 1]], [[0, -1, 0], [0, 1, 0], [0.5, 0, 0]]));
  assert.equal(report.intersectionPairs, 1);
  assert.deepEqual(report.intersectionExamples, [[0, 1]]);
});

test('coplanar overlap and containment are detected in any coordinate plane', () => {
  for (const axis of [0, 1, 2]) {
    const convert = ([a, b]) => axis === 0 ? [0, a, b] : axis === 1 ? [a, 0, b] : [a, b, 0];
    const report = validateMesh(trianglePair([[0, 0], [3, 0], [0, 3]].map(convert), [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8]].map(convert)));
    assert.equal(report.intersectionPairs, 1, `projection axis ${axis}`);
  }
});

test('separated coplanar triangles with overlapping bounding boxes do not intersect', () => {
  const report = validateMesh(trianglePair([[0, 0, 0], [2, 0, 0], [0, 0, 2]], [[2, 0, 2], [2, 0, 0.5], [0.5, 0, 2]]));
  assert.equal(report.intersectionTests, 1);
  assert.equal(report.intersectionPairs, 0);
});

test('triangles on separated parallel planes do not intersect', () => {
  const report = validateMesh(trianglePair([[0, 0, 0], [2, 0, 0], [0, 0, 2]], [[0, 0.1, 0], [2, 0.1, 0], [0, 0.1, 2]]));
  assert.equal(report.intersectionPairs, 0);
});

test('an edge lying in the other triangle plane counts as contact', () => {
  const report = validateMesh(trianglePair([[0, 0, 0], [2, 0, 0], [0, 0, 2]], [[0.2, 0, 0.2], [0.8, 0, 0.2], [0.2, 1, 0.2]]));
  assert.equal(report.intersectionPairs, 1);
});

test('watertight intersecting shells fail intersection and connectedness checks', () => {
  const report = validateMesh(combine(tetrahedron(), tetrahedron([0.3, 0.3, 0.3])));
  assert.equal(report.boundaryEdges, 0);
  assert.equal(report.nonmanifoldEdges, 0);
  assert.equal(report.windingErrors, 0);
  assert.equal(report.components, 2);
  assert.ok(report.intersectionPairs > 0);
  assert.equal(report.valid, false);
});

test('disconnected closed shells are invalid even without surface intersections', () => {
  const report = validateMesh(combine(tetrahedron(), tetrahedron([4, 0, 0])));
  assert.equal(report.components, 2);
  assert.equal(report.boundaryEdges, 0);
  assert.equal(report.intersectionPairs, 0);
  assert.equal(report.valid, false);
});

test('a missing face produces three boundary edges', () => {
  const input = tetrahedron(); input.indices = input.indices.slice(3);
  const report = validateMesh(input);
  assert.equal(report.boundaryEdges, 3);
  assert.equal(report.valid, false);
});

test('inverting all faces gives negative signed volume; flipping one breaks edge winding', () => {
  const input = tetrahedron();
  for (let i = 0; i < input.indices.length; i += 3) [input.indices[i], input.indices[i + 1]] = [input.indices[i + 1], input.indices[i]];
  const report = validateMesh(input);
  assert.equal(report.windingErrors, 0);
  assert.ok(report.volumeMm3 < 0);
  assert.equal(report.valid, false);
  const single = tetrahedron(); [single.indices[0], single.indices[1]] = [single.indices[1], single.indices[0]];
  assert.equal(validateMesh(single).windingErrors, 3);
});

test('NaN vertices, invalid indices, and nonunit/nonfinite normals fail explicitly', () => {
  const badVertex = torus(); badVertex.positions[0] = NaN;
  assert.equal(validateMesh(badVertex).invalidVertices, 1);
  const badIndex = torus(); badIndex.indices[0] = 99999;
  assert.equal(validateMesh(badIndex).invalidIndices, 1);
  const badNormal = torus(); badNormal.normals.set([0, 0, 0], 0); badNormal.normals[3] = Infinity;
  assert.equal(validateMesh(badNormal).invalidNormals, 2);
});

test('degenerate triangles and nonmanifold edges are counted', () => {
  assert.equal(validateMesh(mesh([0, 0, 0, 1, 0, 0, 2, 0, 0], [0, 1, 2])).degenerateTriangles, 1);
  const input = tetrahedron(); input.indices = new Uint32Array([...input.indices, ...input.indices.slice(0, 3)]);
  assert.equal(validateMesh(input).nonmanifoldEdges, 3);
});

test('clearance uses triangle interiors and edges, not just vertex radii', () => {
  const spanning = validateMesh(mesh([[-2, 0, -2], [2, 0, -2], [0, 0, 2]], [0, 1, 2]), { minInnerRadius: 1 });
  assert.equal(spanning.minInnerRadius, 0);
  assert.ok(spanning.errors.some(s => s.startsWith('Inner clearance')));
  const vertical = validateMesh(mesh([[2, -1, -2], [2, 1, 2], [2, 1, -2]], [0, 1, 2]));
  assert.equal(vertical.minInnerRadius, 2);
  assert.equal(validateMesh(torus(), { minInnerRadius: 8 }).valid, false);
});

test('intersection disabling and capped reports are explicit', () => {
  const input = combine(tetrahedron(), tetrahedron([0.3, 0.3, 0.3]));
  const skipped = validateMesh(input, { intersections: false });
  assert.equal(skipped.intersectionCheckPerformed, false);
  assert.equal(skipped.intersectionTests, 0);
  const capped = validateMesh(input, { maxIntersectionPairs: 1 });
  assert.equal(capped.intersectionPairs, 1);
  assert.equal(capped.intersectionsCapped, true);
});

test('an export-size torus remains valid with a bounded broadphase workload', () => {
  const report = validateMesh(torus(256, 128), { minInnerRadius: 7.99 });
  assert.equal(report.triangleCount, 65536);
  assert.equal(report.valid, true, report.errors.join('\n'));
  assert.ok(report.intersectionTests < report.triangleCount * 40, `${report.intersectionTests} narrowphase tests`);
});
