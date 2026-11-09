// Tiny software renderer for comparison images (no browser/GPU available).
// Gold-ish metal with a few soft "softbox" lights in a fake environment.
import fs from 'fs';
import zlib from 'zlib';

function png(w, h, rgb) {
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = buf => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgb.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const LIGHTS = [
  { d: norm3([-0.35, 0.55, 0.75]), cosIn: Math.cos(0.22), cosOut: Math.cos(0.42), I: 4.0 },
  { d: norm3([0.15, 0.25, 0.95]), cosIn: Math.cos(0.18), cosOut: Math.cos(0.55), I: 1.4 },
  { d: norm3([0.75, 0.05, 0.65]), cosIn: Math.cos(0.30), cosOut: Math.cos(0.60), I: 1.6 },
  { d: norm3([0.0, 0.95, -0.3]), cosIn: Math.cos(0.35), cosOut: Math.cos(0.70), I: 1.8 },
  { d: norm3([-0.6, -0.5, 0.6]), cosIn: Math.cos(0.4), cosOut: Math.cos(0.9), I: 0.6 },
];
function env(r) {
  let e = 0.10 + 0.22 * Math.max(0, r[1]) + 0.05 * Math.max(0, r[2]);
  for (const L of LIGHTS) {
    const c = r[0] * L.d[0] + r[1] * L.d[1] + r[2] * L.d[2];
    if (c <= L.cosOut) continue;
    const t = Math.min(1, (c - L.cosOut) / (L.cosIn - L.cosOut));
    e += L.I * t * t * (3 - 2 * t);
  }
  return e;
}
const F0 = [1.0, 0.70, 0.27];

export function renderMesh(binPath, pngPath, { size = 640, tilt = 28, ss = 2 } = {}) {
  const buf = fs.readFileSync(binPath);
  const nv = buf.readUInt32LE(0), nt = buf.readUInt32LE(4);
  const V = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + nv * 12));
  const N = new Float32Array(buf.buffer.slice(buf.byteOffset + 8 + nv * 12, buf.byteOffset + 8 + nv * 24));
  const T = new Uint32Array(buf.buffer.slice(buf.byteOffset + 8 + nv * 24, buf.byteOffset + 8 + nv * 24 + nt * 12));
  const W = size * ss, H = size * ss;
  const a = tilt * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const rz = -12 * Math.PI / 180, cz = Math.cos(rz), sz = Math.sin(rz);
  // Transform: center z, rotate about z a little, tilt about x (top away).
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    let x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2] - 2.5;
    let x1 = x * cz - y * sz, y1 = x * sz + y * cz;
    P[i * 3] = x1; P[i * 3 + 1] = y1 * ca - z * sa; P[i * 3 + 2] = y1 * sa + z * ca;
    let nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let nx1 = nx * cz - ny * sz, ny1 = nx * sz + ny * cz;
    Nn[i * 3] = nx1; Nn[i * 3 + 1] = ny1 * ca - nz * sa; Nn[i * 3 + 2] = ny1 * sa + nz * ca;
  }
  const scale = W / 236;
  const sx = x => W / 2 + x * scale, sy = y => H / 2 - y * scale;
  const zbuf = new Float32Array(W * H).fill(-Infinity);
  const nbuf = new Float32Array(W * H * 3);
  for (let t = 0; t < nt; t++) {
    const i0 = T[t * 3], i1 = T[t * 3 + 1], i2 = T[t * 3 + 2];
    const x0 = sx(P[i0 * 3]), y0 = sy(P[i0 * 3 + 1]), z0 = P[i0 * 3 + 2];
    const x1 = sx(P[i1 * 3]), y1 = sy(P[i1 * 3 + 1]), z1 = P[i1 * 3 + 2];
    const x2 = sx(P[i2 * 3]), y2 = sy(P[i2 * 3 + 1]), z2 = P[i2 * 3 + 2];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let py = minY; py <= maxY; py++) {
      const cy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area;
        const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * z0 + w1 * z1 + w2 * z2;
        const k = py * W + px;
        if (z <= zbuf[k]) continue;
        zbuf[k] = z;
        nbuf[k * 3] = w0 * Nn[i0 * 3] + w1 * Nn[i1 * 3] + w2 * Nn[i2 * 3];
        nbuf[k * 3 + 1] = w0 * Nn[i0 * 3 + 1] + w1 * Nn[i1 * 3 + 1] + w2 * Nn[i2 * 3 + 1];
        nbuf[k * 3 + 2] = w0 * Nn[i0 * 3 + 2] + w1 * Nn[i1 * 3 + 2] + w2 * Nn[i2 * 3 + 2];
      }
    }
  }
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0], hits = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const k = (y * ss + j) * W + (x * ss + i);
      if (zbuf[k] === -Infinity) continue;
      hits++;
      let n = norm3([nbuf[k * 3], nbuf[k * 3 + 1], nbuf[k * 3 + 2]]);
      if (n[2] < 0) n = [-n[0], -n[1], -n[2]];
      // Perspective-ish view vector so flat faces pick up a gradient.
      const wx = ((x * ss + i + 0.5) - W / 2) / scale, wy = (H / 2 - (y * ss + j + 0.5)) / scale;
      const v = norm3([-wx, -wy, 260 - zbuf[k]]);
      const dn = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
      const r = [2 * dn * n[0] - v[0], 2 * dn * n[1] - v[1], 2 * dn * n[2] - v[2]];
      const e = env(r);
      const fr = Math.pow(1 - Math.max(0, dn), 5);
      for (let c = 0; c < 3; c++) {
        const F = F0[c] + (1 - F0[c]) * fr;
        let col = F * e * 0.85 + F0[c] * 0.04;
        col = col / (1 + col * 0.55);         // soft tone map
        acc[c] += Math.min(1, col * 1.25);
      }
    }
    const o = (y * size + x) * 4;
    if (!hits) continue;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(255 * Math.pow(acc[c] / hits, 1 / 2.2));
    out[o + 3] = Math.round(255 * hits / (ss * ss));
  }
  fs.writeFileSync(pngPath, png(size, size, out));
}

if (process.argv[2]) {
  const dir = process.argv[2];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mesh.bin'))) {
    if (process.argv[3] && !f.includes(process.argv[3])) continue;
    renderMesh(dir + '/' + f, dir + '/' + f.replace('.mesh.bin', '.gold.png'));
    console.log('rendered', f);
  }
}
