/** Pure mesh checks in millimetres. The finger bore is the Y axis.
 * Indexed vertices must be welded: topology is checked by index, not position.
 * Intersection checks exclude every pair sharing a vertex, so local foldovers
 * between incident faces are not covered. Contacts within epsilon count as hits.
 * This is a numerical diagnostic, not an exact-arithmetic CAD certification.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const point = (positions, index) => [positions[3 * index], positions[3 * index + 1], positions[3 * index + 2]];

function segmentRadiusSquared(a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const denominator = dx * dx + dz * dz;
  const t = denominator ? Math.max(0, Math.min(1, -(a[0] * dx + a[2] * dz) / denominator)) : 0;
  return (a[0] + t * dx) ** 2 + (a[2] + t * dz) ** 2;
}

function triangleRadius(a, b, c) {
  const ab = a[0] * b[2] - a[2] * b[0];
  const bc = b[0] * c[2] - b[2] * c[0];
  const ca = c[0] * a[2] - c[2] * a[0];
  // A nonzero projected area is essential: vertical triangles project to lines.
  if (ab + bc + ca !== 0 && ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0))) return 0;
  return Math.sqrt(Math.min(segmentRadiusSquared(a, b), segmentRadiusSquared(b, c), segmentRadiusSquared(c, a)));
}

function separatedOnAxis(a, b, axis, epsilon) {
  const length = Math.hypot(...axis);
  if (length === 0) return false;
  const p = a.map(v => dot(v, axis)), q = b.map(v => dot(v, axis));
  const tolerance = epsilon * length;
  return Math.max(...p) < Math.min(...q) - tolerance || Math.max(...q) < Math.min(...p) - tolerance;
}

// Triangle SAT, including in-plane edge normals for the coplanar case. All
// projections are relative to a[0], avoiding cancellation far from the origin.
function trianglesIntersect(ta, tb, epsilon) {
  const origin = ta.vertices[0];
  const a = ta.vertices.map(v => sub(v, origin));
  const b = tb.vertices.map(v => sub(v, origin));
  const ae = [sub(a[1], a[0]), sub(a[2], a[1]), sub(a[0], a[2])];
  const be = [sub(b[1], b[0]), sub(b[2], b[1]), sub(b[0], b[2])];
  const an = cross(ae[0], ae[1]), bn = cross(be[0], be[1]);
  if (separatedOnAxis(a, b, an, epsilon) || separatedOnAxis(a, b, bn, epsilon)) return false;
  for (const e of ae) for (const f of be) if (separatedOnAxis(a, b, cross(e, f), epsilon)) return false;
  // These extra axes are valid separating axes for any pair and are necessary
  // when both triangles lie on the same plane (edge cross products are normal).
  for (const e of ae) if (separatedOnAxis(a, b, cross(an, e), epsilon)) return false;
  for (const e of be) if (separatedOnAxis(a, b, cross(bn, e), epsilon)) return false;
  return true;
}

function overlaps(a, b, epsilon) {
  return a.min[0] <= b.max[0] + epsilon && b.min[0] <= a.max[0] + epsilon &&
    a.min[1] <= b.max[1] + epsilon && b.min[1] <= a.max[1] + epsilon &&
    a.min[2] <= b.max[2] + epsilon && b.min[2] <= a.max[2] + epsilon;
}

function buildBVH(triangles) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], t.min[k]); max[k] = Math.max(max[k], t.max[k]);
  }
  if (triangles.length <= 8) return { min, max, triangles };
  let axis = 0;
  for (let k = 1; k < 3; k++) if (max[k] - min[k] > max[axis] - min[axis]) axis = k;
  triangles.sort((a, b) => (a.min[axis] + a.max[axis]) - (b.min[axis] + b.max[axis]));
  const middle = triangles.length >> 1;
  return { min, max, left: buildBVH(triangles.slice(0, middle)), right: buildBVH(triangles.slice(middle)) };
}

function findIntersections(triangles, epsilon, limit, report) {
  if (triangles.length < 2) return;
  const root = buildBVH(triangles.slice());
  const test = (a, b) => {
    if (!overlaps(a, b, epsilon) || a.indices.some(i => b.indices.includes(i))) return;
    report.intersectionTests++;
    if (trianglesIntersect(a, b, epsilon)) {
      report.intersectionPairs++;
      report.intersectionExamples.push([a.id, b.id]);
    }
  };
  function visit(a, b) {
    if (report.intersectionPairs >= limit) { report.intersectionsCapped = true; return; }
    if (!overlaps(a, b, epsilon)) return;
    if (a === b) {
      if (a.triangles) {
        for (let i = 0; i < a.triangles.length; i++) for (let j = i + 1; j < a.triangles.length; j++) {
          if (report.intersectionPairs >= limit) { report.intersectionsCapped = true; return; }
          test(a.triangles[i], a.triangles[j]);
        }
      } else { visit(a.left, a.left); visit(a.left, a.right); visit(a.right, a.right); }
    } else if (a.triangles && b.triangles) {
      for (const ta of a.triangles) for (const tb of b.triangles) {
        if (report.intersectionPairs >= limit) { report.intersectionsCapped = true; return; }
        test(ta, tb);
      }
    } else if (a.triangles) { visit(a, b.left); visit(a, b.right); }
    else { visit(a.left, b); visit(a.right, b); }
  }
  visit(root, root);
}

/**
 * Validate a welded, indexed, outward-oriented closed single-component mesh.
 * `intersections` defaults true. Set false for an explicitly partial preview
 * check. `minInnerRadius` is a required cylindrical clearance, not a vertex-only
 * approximation. `maxIntersectionPairs` defaults 16; counts are lower bounds if
 * intersectionsCapped is true. Triangle IDs in intersectionExamples are zero-based.
 * Optional epsilon is a positive distance in mm. Normal length tolerance is 1e-3.
 */
export function validateMesh(mesh, options = {}) {
  const { positions, indices, normals } = mesh ?? {};
  const report = {
    valid: false, errors: [], vertexCount: Math.floor((positions?.length ?? 0) / 3),
    triangleCount: Math.floor((indices?.length ?? 0) / 3), components: 0,
    boundaryEdges: 0, nonmanifoldEdges: 0, windingErrors: 0, degenerateTriangles: 0,
    invalidVertices: 0, invalidIndices: 0, invalidNormals: 0, unusedVertices: 0,
    intersectionPairs: 0, intersectionTests: 0, intersectionExamples: [], intersectionsCapped: false,
    intersectionCheckPerformed: false, minInnerRadius: null, volumeMm3: null,
  };
  if (!positions || !indices || !positions.length || !indices.length || positions.length % 3 || indices.length % 3) {
    report.errors.push('Positions and triangle indices must be nonempty xyz/index triples.'); return report;
  }
  if (options.minInnerRadius !== undefined && (!Number.isFinite(options.minInnerRadius) || options.minInnerRadius < 0)) {
    report.errors.push('minInnerRadius must be a finite nonnegative distance.'); return report;
  }
  if (options.epsilon !== undefined && (!Number.isFinite(options.epsilon) || options.epsilon <= 0)) {
    report.errors.push('epsilon must be a finite positive distance.'); return report;
  }
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    if (![positions[i], positions[i + 1], positions[i + 2]].every(Number.isFinite)) report.invalidVertices++;
    else for (let k = 0; k < 3; k++) { minimum[k] = Math.min(minimum[k], positions[i + k]); maximum[k] = Math.max(maximum[k], positions[i + k]); }
  }
  for (const i of indices) if (!Number.isInteger(i) || i < 0 || i >= report.vertexCount) report.invalidIndices++;
  if (normals !== undefined) {
    if (!normals || normals.length !== positions.length) report.errors.push('Normals must contain one xyz triple per vertex.');
    else for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-3) report.invalidNormals++;
    }
  }
  if (report.invalidVertices) report.errors.push(`${report.invalidVertices} nonfinite vertices.`);
  if (report.invalidIndices) report.errors.push(`${report.invalidIndices} invalid triangle indices.`);
  if (report.invalidNormals) report.errors.push(`${report.invalidNormals} nonfinite or nonunit normals.`);
  if (report.invalidVertices || report.invalidIndices) return report;
  const scale = Math.max(...maximum.map((v, k) => v - minimum[k]), 1);
  const epsilon = options.epsilon ?? scale * 1e-9;
  report.epsilonMm = epsilon;
  report.bounds = { min: minimum, max: maximum };
  const edges = new Map(), used = new Uint8Array(report.vertexCount);
  const parent = Int32Array.from({ length: report.triangleCount }, (_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const triangles = [];
  let radius = Infinity, volume = 0;
  // Use a nearby volume origin for numerical stability on translated meshes.
  const volumeOrigin = minimum.map((v, k) => (v + maximum[k]) / 2);
  for (let t = 0; t < report.triangleCount; t++) {
    const ids = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
    const vertices = ids.map(i => point(positions, i));
    const [a, b, c] = vertices;
    const ab = sub(b, a), ac = sub(c, a), bc = sub(c, b);
    const twiceArea = Math.hypot(...cross(ab, ac));
    const longestEdge = Math.max(Math.hypot(...ab), Math.hypot(...ac), Math.hypot(...bc));
    const degenerate = new Set(ids).size < 3 || twiceArea <= epsilon * Math.max(longestEdge, epsilon);
    if (degenerate) report.degenerateTriangles++;
    radius = Math.min(radius, triangleRadius(a, b, c));
    volume += dot(sub(a, volumeOrigin), cross(sub(b, volumeOrigin), sub(c, volumeOrigin))) / 6;
    for (let k = 0; k < 3; k++) {
      const u = ids[k], v = ids[(k + 1) % 3]; used[u] = 1;
      const key = u < v ? `${u},${v}` : `${v},${u}`;
      const edge = edges.get(key), direction = u < v ? 1 : -1;
      if (edge) { edge.count++; edge.direction += direction; parent[find(t)] = find(edge.triangle); }
      else edges.set(key, { count: 1, direction, triangle: t });
    }
    if (!degenerate) triangles.push({ id: t, indices: ids, vertices,
      min: [0, 1, 2].map(k => Math.min(a[k], b[k], c[k])), max: [0, 1, 2].map(k => Math.max(a[k], b[k], c[k])) });
  }
  report.components = new Set(Array.from(parent, (_, i) => find(i))).size;
  report.unusedVertices = used.reduce((sum, value) => sum + (value === 0), 0);
  for (const edge of edges.values()) {
    if (edge.count === 1) report.boundaryEdges++;
    if (edge.count > 2) report.nonmanifoldEdges++;
    if (edge.count === 2 && edge.direction !== 0) report.windingErrors++;
  }
  report.minInnerRadius = radius;
  report.volumeMm3 = volume;
  if (options.intersections !== false) {
    const limit = options.maxIntersectionPairs ?? 16;
    if (!Number.isInteger(limit) || limit < 1) report.errors.push('maxIntersectionPairs must be a positive integer.');
    else { report.intersectionCheckPerformed = true; findIntersections(triangles, epsilon, limit, report); }
  }
  for (const [field, description] of [['boundaryEdges', 'boundary edges'], ['nonmanifoldEdges', 'nonmanifold edges'], ['windingErrors', 'inconsistently oriented edges'], ['degenerateTriangles', 'degenerate triangles'], ['unusedVertices', 'unused vertices'], ['intersectionPairs', 'nonadjacent intersecting triangle pairs']]) {
    if (report[field]) report.errors.push(`${report[field]} ${description}${field === 'intersectionPairs' && report.intersectionsCapped ? ' (count capped)' : ''}.`);
  }
  if (report.components !== 1) report.errors.push(`Expected one connected surface; found ${report.components}.`);
  if (volume <= epsilon ** 3) report.errors.push('Signed volume must be positive; check outward winding and collapsed geometry.');
  if (options.minInnerRadius !== undefined && radius + epsilon < options.minInnerRadius) report.errors.push(`Inner clearance ${radius.toFixed(6)} mm is below required ${options.minInnerRadius} mm.`);
  report.valid = report.errors.length === 0;
  return report;
}
