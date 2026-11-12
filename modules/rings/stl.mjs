/** Binary STL uses the SAME mm mesh; no viewer transform or display scale. */
export function meshToSTL(mesh) {
  const { positions: p, indices: idx } = mesh;
  const count = idx.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50), v = new DataView(buffer);
  new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode('Constelier ring studio | units: millimetres | validated mesh'));
  v.setUint32(80, count, true);
  for (let t = 0; t < count; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
    const w = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const length = Math.hypot(...n);
    let off = 84 + t * 50;
    for (const x of n) { v.setFloat32(off, x / length, true); off += 4; }
    for (const at of [a, b, c]) for (let j = 0; j < 3; j++) { v.setFloat32(off, p[at + j], true); off += 4; }
  }
  return buffer;
}
