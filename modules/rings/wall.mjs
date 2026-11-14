/** Sample inward vertex-normal chords in millimetres. This is NOT a continuous
 * minimum thickness proof, nearest-surface distance, or manufacturability claim.
 * Input should already be a closed, outward-oriented, welded mesh. Rays skip
 * incident triangles and contacts within epsilon. Inspect missedRays and
 * backfacingHits: either makes the sampled result incomplete/unreliable.
 */

function buildTree(triangles) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], t.min[k]); max[k] = Math.max(max[k], t.max[k]);
  }
  if (triangles.length <= 8) return { min, max, triangles };
  let axis = 0;
  for (let k = 1; k < 3; k++) if (max[k] - min[k] > max[axis] - min[axis]) axis = k;
  triangles.sort((a, b) => a.min[axis] + a.max[axis] - b.min[axis] - b.max[axis]);
  const middle = triangles.length >> 1;
  return { min, max, left: buildTree(triangles.slice(0, middle)), right: buildTree(triangles.slice(middle)) };
}

function boxDistance(node, origin, direction, limit, epsilon) {
  let near = 0, far = limit;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(direction[k]) < 1e-15) {
      if (origin[k] < node.min[k] - epsilon || origin[k] > node.max[k] + epsilon) return Infinity;
    } else {
      let a = (node.min[k] - epsilon - origin[k]) / direction[k];
      let b = (node.max[k] + epsilon - origin[k]) / direction[k];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return near;
}

function rayTriangle(positions, ids, origin, d, epsilon) {
  const a = ids[0] * 3, b = ids[1] * 3, c = ids[2] * 3;
  const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
  const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
  const px = d[1] * vz - d[2] * vy, py = d[2] * vx - d[0] * vz, pz = d[0] * vy - d[1] * vx;
  const determinant = ux * px + uy * py + uz * pz;
  if (Math.abs(determinant) <= 1e-12 * Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz)) return null;
  const tx = origin[0] - positions[a], ty = origin[1] - positions[a + 1], tz = origin[2] - positions[a + 2];
  const u = (tx * px + ty * py + tz * pz) / determinant;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const qx = ty * uz - tz * uy, qy = tz * ux - tx * uz, qz = tx * uy - ty * ux;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) / determinant;
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const distance = (vx * qx + vy * qy + vz * qz) / determinant;
  return distance > epsilon ? { distance, backfacing: determinant > 0 } : null;
}

function selectVertices(mesh, count) {
  const { positions: p, resolution } = mesh, vertexCount = p.length / 3;
  const selected = new Set();
  const add = i => { if (selected.size < count) selected.add(i); };
  // Always include coordinate extrema, including tips away from grid angles.
  for (let k = 0; k < 3; k++) {
    let lo = 0, hi = 0;
    for (let i = 1; i < vertexCount; i++) { if (p[i * 3 + k] < p[lo * 3 + k]) lo = i; if (p[i * 3 + k] > p[hi * 3 + k]) hi = i; }
    add(lo); add(hi);
  }
  const loops = resolution?.loops, sections = resolution?.sections;
  const grid = Number.isInteger(loops) && Number.isInteger(sections) && loops > 0 && sections >= 4 && loops * sections === vertexCount;
  if (grid && count >= 16) {
    const sectionSamples = Math.min(sections, Math.max(4, 2 ** Math.floor(Math.log2(Math.sqrt(count / 4)))));
    const loopSamples = Math.min(loops, Math.max(4, Math.ceil(count / sectionSamples)));
    const chosenLoops = new Set();
    const addLoop = i => { if (chosenLoops.size < loopSamples) chosenLoops.add((i + loops) % loops); };
    for (let k = 0; k < 4; k++) addLoop(Math.floor(k * loops / 4));
    // Find section-width and axial-center extrema from actual geometry; no
    // wave equation or hard-coded wave phase is needed by this diagnostic.
    const radialSpan = [], axialCenter = [];
    for (let i = 0; i < loops; i++) {
      let minR = Infinity, maxR = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let j = 0; j < sections; j++) {
        const at = (i * sections + j) * 3, radius = Math.hypot(p[at], p[at + 2]);
        minR = Math.min(minR, radius); maxR = Math.max(maxR, radius);
        minY = Math.min(minY, p[at + 1]); maxY = Math.max(maxY, p[at + 1]);
      }
      radialSpan.push(maxR - minR); axialCenter.push((minY + maxY) / 2);
    }
    for (const values of [radialSpan, axialCenter]) {
      let lo = 0, hi = 0;
      for (let i = 1; i < loops; i++) { if (values[i] < values[lo]) lo = i; if (values[i] > values[hi]) hi = i; }
      if (values[hi] - values[lo] <= 1e-5) continue;
      addLoop(lo); addLoop(hi);
      for (let i = 0; i < loops; i++) {
        const a = values[(i + loops - 1) % loops], b = values[i], c = values[(i + 1) % loops];
        if ((b <= a && b < c) || (b >= a && b > c)) addLoop(i);
      }
    }
    // Fill the largest remaining angular gaps to keep coverage distributed.
    while (chosenLoops.size < loopSamples) {
      const sorted = [...chosenLoops].sort((a, b) => a - b);
      let gap = 0, middle = 0;
      for (let i = 0; i < sorted.length; i++) {
        const width = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + loops) - sorted[i];
        if (width > gap) { gap = width; middle = (sorted[i] + Math.floor(width / 2)) % loops; }
      }
      addLoop(middle);
    }
    // Cardinal cross-section samples come first at every selected theta, then
    // intermediate section angles. This retains all extrema when budget trims.
    const sectionIndices = [];
    for (let k = 0; k < 4; k++) sectionIndices.push(Math.floor(k * sections / 4));
    for (let k = 0; k < sectionSamples; k++) {
      const j = Math.floor(k * sections / sectionSamples); if (!sectionIndices.includes(j)) sectionIndices.push(j);
    }
    for (const j of sectionIndices) for (const i of chosenLoops) add(i * sections + j);
  }
  // Generic meshes have no parameter grid. An irrational stride avoids always
  // picking the same section index in regularly indexed geometry.
  for (let k = 0; selected.size < count && k < count * 4; k++) add(Math.floor(((k * 0.6180339887498949) % 1) * vertexCount));
  for (let i = 0; selected.size < count; i++) add(i);
  return { indices: [...selected], strategy: grid ? 'parameter-grid-and-geometric-extrema' : 'coordinate-extrema-and-distributed-vertices' };
}

export function sampleWallThickness(mesh, { samples = 256 } = {}) {
  const started = performance.now(), { positions: p, indices: idx } = mesh ?? {};
  if (!p?.length || p.length % 3 || !idx?.length || idx.length % 3) throw new Error('Expected nonempty indexed xyz triangle mesh.');
  if (!Number.isInteger(samples) || samples < 1) throw new Error('samples must be a positive integer.');
  const count = p.length / 3;
  for (const coordinate of p) if (!Number.isFinite(coordinate)) throw new Error('Mesh positions must be finite.');
  for (const i of idx) if (!Number.isInteger(i) || i < 0 || i >= count) throw new Error('Invalid mesh index.');
  if (mesh.normals !== undefined && mesh.normals?.length !== p.length) throw new Error('Normals must match positions.');
  const normals = mesh.normals ? Float64Array.from(mesh.normals) : new Float64Array(p.length);
  const triangles = [];
  for (let i = 0; i < idx.length; i += 3) {
    const ids = [idx[i], idx[i + 1], idx[i + 2]];
    triangles.push({ id: i / 3, indices: ids, min: [0, 1, 2].map(k => Math.min(...ids.map(v => p[v * 3 + k]))), max: [0, 1, 2].map(k => Math.max(...ids.map(v => p[v * 3 + k]))) });
    if (!mesh.normals) {
      const [a, b, c] = ids.map(v => v * 3);
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      for (const at of [a, b, c]) { normals[at] += uy * vz - uz * vy; normals[at + 1] += uz * vx - ux * vz; normals[at + 2] += ux * vy - uy * vx; }
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (!Number.isFinite(length) || length === 0) throw new Error('Vertex normals must be finite and nonzero.');
    for (let k = 0; k < 3; k++) normals[i + k] /= length;
  }
  const tree = buildTree(triangles);
  const epsilon = Math.max(1, ...tree.max.map((v, k) => v - tree.min[k])) * 1e-8;
  const selection = selectVertices(mesh, Math.min(samples, count));
  const result = { sampledMinWallMm: null, sampledMaxWallMm: null, samplesRequested: samples, samplesTested: selection.indices.length,
    hits: 0, missedRays: 0, backfacingHits: 0, triangleTests: 0, epsilonMm: epsilon, samplingStrategy: selection.strategy,
    normalsSource: mesh.normals ? 'provided-normalized' : 'computed-area-weighted', samples: [], elapsedMs: 0,
    diagnostic: 'Sampled inward normal chords; not a continuous minimum wall thickness guarantee.' };
  for (const vertexIndex of selection.indices) {
    const origin = [p[vertexIndex * 3], p[vertexIndex * 3 + 1], p[vertexIndex * 3 + 2]];
    const direction = [-normals[vertexIndex * 3], -normals[vertexIndex * 3 + 1], -normals[vertexIndex * 3 + 2]];
    let best = Infinity, hit = null;
    function visit(node) {
      if (boxDistance(node, origin, direction, best, epsilon) === Infinity) return;
      if (node.triangles) {
        for (const triangle of node.triangles) {
          if (triangle.indices.includes(vertexIndex)) continue;
          result.triangleTests++;
          const candidate = rayTriangle(p, triangle.indices, origin, direction, epsilon);
          if (candidate && candidate.distance < best) { best = candidate.distance; hit = { ...candidate, triangleIndex: triangle.id }; }
        }
      } else {
        const left = boxDistance(node.left, origin, direction, best, epsilon), right = boxDistance(node.right, origin, direction, best, epsilon);
        if (left <= right) { if (left !== Infinity) visit(node.left); if (right <= best) visit(node.right); }
        else { if (right !== Infinity) visit(node.right); if (left <= best) visit(node.left); }
      }
    }
    visit(tree);
    if (hit) {
      result.hits++; if (hit.backfacing) result.backfacingHits++;
      result.sampledMinWallMm = Math.min(result.sampledMinWallMm ?? Infinity, best);
      result.sampledMaxWallMm = Math.max(result.sampledMaxWallMm ?? -Infinity, best);
      result.samples.push({ vertexIndex, triangleIndex: hit.triangleIndex, wallMm: best, backfacing: hit.backfacing });
    } else { result.missedRays++; result.samples.push({ vertexIndex, triangleIndex: null, wallMm: null }); }
  }
  result.elapsedMs = performance.now() - started;
  return result;
}
