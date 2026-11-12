// Render top-down and tilted gold previews (PPM) for each pendant in people.json.
//   node tools/march-remake/render.mjs <people.json> <outDir>
import fs from 'fs';
import path from 'path';
import { build, SETTINGS } from './build.mjs';

function vertexNormals(V, T) {
  const N = new Float32Array(V.length);
  for (let t = 0; t < T.length; t += 3) {
    const a = 3 * T[t], b = 3 * T[t + 1], c = 3 * T[t + 2];
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  return N;
}

function raster(V, N, T, W, H, scale, R, zc) {
  const nv = V.length / 3, P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    const x = V[3 * i], y = -V[3 * i + 1], z = V[3 * i + 2] - zc; // flip y: model top (-y) is up in the image
    const nx = N[3 * i], ny = -N[3 * i + 1], nz = N[3 * i + 2];
    for (let r = 0; r < 3; r++) { P[3 * i + r] = R[r][0] * x + R[r][1] * y + R[r][2] * z; Nn[3 * i + r] = R[r][0] * nx + R[r][1] * ny + R[r][2] * nz; }
    P[3 * i] = P[3 * i] * scale + W / 2; P[3 * i + 1] = -P[3 * i + 1] * scale + H / 2;
  }
  const depth = new Float32Array(W * H).fill(-1e9), nb = new Float32Array(W * H * 3);
  for (let k = 0; k < T.length; k += 3) {
    const a = T[k], b = T[k + 1], c = T[k + 2];
    const ax = P[3 * a], ay = P[3 * a + 1], bx = P[3 * b], by = P[3 * b + 1], cx = P[3 * c], cy = P[3 * c + 1];
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(area) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area, w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * P[3 * a + 2] + w1 * P[3 * b + 2] + w2 * P[3 * c + 2]; const o = y * W + x; if (z <= depth[o]) continue; depth[o] = z;
      for (let r = 0; r < 3; r++) nb[3 * o + r] = w0 * Nn[3 * a + r] + w1 * Nn[3 * b + r] + w2 * Nn[3 * c + r];
    }
  }
  return { depth, nb };
}

function shade({ depth, nb }, W, H, bg) {
  const img = Buffer.alloc(W * H * 3);
  const L = [[-0.45, 0.55, 0.7], [0.6, 0.35, 0.72], [0, -0.6, 0.8]].map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
  for (let o = 0; o < W * H; o++) {
    if (depth[o] < -1e8) { img[3 * o] = bg[0]; img[3 * o + 1] = bg[1]; img[3 * o + 2] = bg[2]; continue; }
    let nx = nb[3 * o], ny = nb[3 * o + 1], nz = nb[3 * o + 2]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let s = 0.22;
    L.forEach((l, i) => { const h = [l[0], l[1], l[2] + 1], hl = Math.hypot(...h); const nh = Math.max(0, (nx * h[0] + ny * h[1] + nz * h[2]) / hl);
      s += (i === 2 ? 0.15 : 0.4) * Math.max(0, nx * l[0] + ny * l[1] + nz * l[2]) + (i === 2 ? 0.3 : 0.8) * Math.pow(nh, 50); });
    s *= 0.85 + 0.25 * (0.5 + 0.5 * Math.sin(ny * 5 + nx * 2));
    img[3 * o] = Math.min(255, 255 * s); img[3 * o + 1] = Math.min(255, 255 * s * 0.79); img[3 * o + 2] = Math.min(255, 255 * s * 0.45);
  }
  return img;
}

function downsample(img, W, H, f) {
  const w = W / f, h = H / f, out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += img[3 * ((y * f + j) * W + x * f + i) + c];
    out[3 * (y * w + x) + c] = s / (f * f);
  }
  return out;
}

const rot = (deg) => { const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };

const [peopleFile, outDir] = process.argv.slice(2);
const people = JSON.parse(fs.readFileSync(peopleFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const SIZE = 560, SS = 2, W = SIZE * SS;
for (const p of people) for (const [name, S] of Object.entries(SETTINGS)) {
  const { mesh, mm } = build(p, S);
  const V = mesh.vertices, T = mesh.triangles, N = vertexNormals(V, T);
  // same physical scale for both settings: 30 mm across the frame
  const scale = (W / 30) * mm;
  for (const [view, R] of [['top', rot(0)], ['tilt', rot(-55)]]) {
    const img = downsample(shade(raster(V, N, T, W, W, scale, R, S.thickness / 2), W, W, [246, 244, 240]), W, W, SS);
    fs.writeFileSync(path.join(outDir, `${p.id}-${name}-${view}.ppm`), Buffer.concat([Buffer.from(`P6 ${SIZE} ${SIZE} 255\n`), img]));
  }
  console.log('rendered', p.id, name);
}
