// A signed distance field of the pendant's outline, seen from above: for each
// texel, how far the nearest metal edge is (negative inside the metal). The
// shaders extrude it to the pendant's thickness and trace rays against it,
// which is what gives real reflections of the bars in each other and soft,
// contact-hardening shadows without rendering the mesh more than once.

const INF = 1e20;

// Felzenszwalb & Huttenlocher squared distance transform, one row or column.
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    do {
      const p = v[k];
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
    } while (s <= z[k] && --k >= 0);
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

// Squared distance transform of a grid of starting values: 0 where the target
// is, INF where it is not, and a small in-between value on edge texels (see
// buildPendantSdf). Overwrites and returns `grid`.
function transform(grid, size) {
  const f = new Float64Array(size), d = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) f[y] = grid[y * size + x];
    edt1d(f, size, d, v, z);
    for (let y = 0; y < size; y++) grid[y * size + x] = d[y];
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) f[x] = grid[y * size + x];
    edt1d(f, size, d, v, z);
    for (let x = 0; x < size; x++) grid[y * size + x] = d[x];
  }
  return grid;
}

// A light blur, about a texel wide, to take out what little texel-scale
// ripple is left in the field.
function smooth(a, size) {
  const t = new Float32Array(a.length), at = (i) => Math.min(size - 1, Math.max(0, i));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = y * size;
    t[r + x] = (a[r + at(x - 2)] + 4 * a[r + at(x - 1)] + 6 * a[r + x] + 4 * a[r + at(x + 1)] + a[r + at(x + 2)]) / 16;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    a[y * size + x] = (t[at(y - 2) * size + x] + 4 * t[at(y - 1) * size + x] + 6 * t[y * size + x] + 4 * t[at(y + 1) * size + x] + t[at(y + 2) * size + x]) / 16;
  }
}

// Marks every texel connected to the border through empty space: the outside
// of the pendant, as opposed to the voids inside it.
function exterior(inside, size) {
  const out = new Uint8Array(size * size), stack = [0];
  out[0] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % size, y = (i - x) / size;
    const visit = (j) => { if (!inside[j] && !out[j]) { out[j] = 1; stack.push(j); } };
    if (x > 0) visit(i - 1);
    if (x < size - 1) visit(i + 1);
    if (y > 0) visit(i - size);
    if (y < size - 1) visit(i + size);
  }
  return out;
}

// Returns { data, size, extent }. `data` holds two values per texel: the signed
// distance to the nearest metal edge, and how far inside the outer rim the
// texel is (0 outside it).
//
// `vertices`/`triangles` are the pendant mesh lying in the XY plane. The field
// covers the square [-extent, extent] on both axes, in the mesh's own units.
export function buildPendantSdf(vertices, triangles, extent, size = 1024) {
  // OffscreenCanvas lets this run in a worker, off the main thread.
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const k = size / (2 * extent);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  // Upward-facing triangles alone cover the whole silhouette.
  for (let t = 0; t < triangles.length; t += 3) {
    const a = 3 * triangles[t], b = 3 * triangles[t + 1], c = 3 * triangles[t + 2];
    const ax = vertices[a], ay = vertices[a + 1], bx = vertices[b], by = vertices[b + 1], cx = vertices[c], cy = vertices[c + 1];
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) <= 0) continue;
    ctx.moveTo((ax + extent) * k, (ay + extent) * k);
    ctx.lineTo((bx + extent) * k, (by + extent) * k);
    ctx.lineTo((cx + extent) * k, (cy + extent) * k);
    ctx.closePath();
  }
  ctx.fill();
  const px = ctx.getImageData(0, 0, size, size).data, n = size * size;
  // The canvas antialiases the outline, so an edge texel's coverage says how
  // far across it the edge runs. Starting the transform from that, rather
  // than from a hard in-or-out mask, places edges to a fraction of a texel
  // and keeps the field (and normals taken from it) free of stair-steps.
  const cover = new Float32Array(n), inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) { cover[i] = px[4 * i + 3] / 255; inside[i] = cover[i] >= 0.5 ? 1 : 0; }
  // Only texels that really straddle an edge keep a partial coverage. Hairline
  // seams between the mesh's triangles also come out a shade under full, and
  // would otherwise read as tiny pits in the metal.
  for (let i = 0; i < n; i++) {
    const x = i % size, y = (i - x) / size, me = inside[i];
    const onEdge = (x > 0 && inside[i - 1] !== me) || (x < size - 1 && inside[i + 1] !== me) || (y > 0 && inside[i - size] !== me) || (y < size - 1 && inside[i + size] !== me);
    if (!onEdge) cover[i] = me;
  }
  const out = exterior(inside, size);
  const toMetal = new Float64Array(n), toVoid = new Float64Array(n), toOutside = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = cover[i], x = i % size, y = (i - x) / size;
    toMetal[i] = a >= 1 ? 0 : a <= 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    toVoid[i] = a >= 1 ? INF : a <= 0 ? 0 : Math.max(0, a - 0.5) ** 2;
    // Only the pendant's outer edge counts here, not the edges of its voids.
    const onOuterEdge = a < 1 && (out[i] || (x > 0 && out[i - 1]) || (x < size - 1 && out[i + 1]) || (y > 0 && out[i - size]) || (y < size - 1 && out[i + size]));
    toOutside[i] = out[i] && a <= 0 ? 0 : onOuterEdge ? Math.max(0, a - 0.5) ** 2 : INF;
  }
  transform(toMetal, size); transform(toVoid, size); transform(toOutside, size);
  const texel = (2 * extent) / size;
  const edge = new Float32Array(n), rim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    edge[i] = (Math.sqrt(toMetal[i]) - Math.sqrt(toVoid[i])) * texel;
    rim[i] = Math.sqrt(toOutside[i]) * texel;
  }
  smooth(edge, size); smooth(rim, size);
  const data = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) { data[2 * i] = edge[i]; data[2 * i + 1] = rim[i]; }
  return { data, size, extent };
}
