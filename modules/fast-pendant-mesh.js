// modules/fast-pendant-mesh.js
//
// Builds the pendant as a triangle mesh straight from the 2D outline, with no
// OpenCascade: the disc is extruded, the voids go through it, and the top and
// bottom edges get a true quarter-circle fillet of radius r.
//
// How the fillet is made: a rolling-ball fillet between a flat face and a
// vertical wall is exactly the outline offset inward by r(1 - cos phi) at
// height r sin phi. So each boundary point gets a column of vertices along
// that quarter circle, and the flat faces are the outline offset by the full
// r, triangulated with earcut. Where the offset would fold over (a wire
// narrower than 2r) the radius steps down, like Replicad's fillet retry does.
//
// Input is the `serializeChainsFor3D()` outline data (line, arc and cubic
// bezier links), so any outline algorithm works unchanged.
//
// - buildPreviewMesh(): indexed mesh with normals for Three.js (crisp creases)
// - buildPendantMesh(): welded, watertight mesh for export
// - meshToSTL(): binary STL for the caster
// Coordinates match replicad's mesh: z = 0 .. thickness, model units.

import { Earcut } from 'three/src/extras/Earcut.js';

const DEG = Math.PI / 180;

// ── Outline sampling ─────────────────────────────────────────────────────

function bezierFlat(b, tol) {
  const p = b[0], q = b[3], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1e-9;
  const d1 = Math.abs((b[1][0] - p[0]) * dy - (b[1][1] - p[1]) * dx) / L;
  const d2 = Math.abs((b[2][0] - p[0]) * dy - (b[2][1] - p[1]) * dx) / L;
  return Math.max(d1, d2) * 0.75 < tol;
}

function flattenBezier(b, tol, out, depth = 0) {
  if (depth > 12 || bezierFlat(b, tol)) { out.push(b[0]); return; }
  const m = (a, c) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const p01 = m(b[0], b[1]), p12 = m(b[1], b[2]), p23 = m(b[2], b[3]);
  const p012 = m(p01, p12), p123 = m(p12, p23), mid = m(p012, p123);
  flattenBezier([b[0], p01, p012, mid], tol, out, depth + 1);
  flattenBezier([mid, p123, p23, b[3]], tol, out, depth + 1);
}

// One closed chain -> polyline. Lines keep their endpoints; arcs and beziers
// are split so the chord error stays under `tol`.
function sampleChain(links, tol, maxStep) {
  const pts = [];
  for (const l of links) {
    if (l.type === 'line') {
      pts.push(l.reversed ? l.end : l.origin);
    } else if (l.type === 'bezier') {
      flattenBezier(l.reversed ? [l.p3, l.c2, l.c1, l.p0] : [l.p0, l.c1, l.c2, l.p3], tol, pts);
    } else if (l.type === 'arc') {
      let span = l.endAngle - l.startAngle;
      while (span <= 0) span += 360;
      span *= DEG;
      const step = Math.min(maxStep, 2 * Math.acos(Math.max(-1, 1 - tol / l.radius)) || maxStep);
      const n = Math.max(1, Math.ceil(span / step));
      const a0 = l.startAngle * DEG;
      for (let i = 0; i < n; i++) {
        const a = a0 + span * (l.reversed ? 1 - i / n : i / n);
        pts.push([l.origin[0] + l.radius * Math.cos(a), l.origin[1] + l.radius * Math.sin(a)]);
      }
    }
  }
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-4) break;
    out.pop();
  }
  return out;
}

function signedArea(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// Outer circle (metal inside) plus voids (metal outside), all CCW.
export function outlineLoops(data, tol = 0.01, maxStep = 6 * DEG) {
  const outerR = data.circleRadius + data.borderThickness;
  const loops = [{ hole: false, pts: sampleChain([{ type: 'arc', origin: [0, 0], radius: outerR, startAngle: 0, endAngle: 360, reversed: false }], tol, maxStep) }];
  for (const ch of data.voidChains) {
    const pts = sampleChain(ch.links, tol, maxStep);
    if (pts.length >= 3) loops.push({ hole: true, pts });
  }
  for (const L of loops) if (signedArea(L.pts) < 0) L.pts.reverse();
  return loops;
}

// ── Offset frames ────────────────────────────────────────────────────────

// For each polyline point: `inset` (vector into the metal, sized so that
// p + inset * r is the outline offset by r) and one or two shading normals
// `d` (unit, pointing out of the metal).
//
// Where the offsets converge the corner gets an exact miter (and two normals
// if it is sharper than the crease angle, so it shades crisply). Where they
// diverge (a void's tip, seen from the metal) it gets a round join: frames
// sweeping between the two edge normals, which is what a rolling ball does.
function loopFrames(pts, isHole, creaseCos) {
  const n = pts.length;
  const edgeN = new Array(n), edgeD = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    edgeD[i] = [dx, dy];
    edgeN[i] = isHole ? [-dy, dx] : [dy, -dx]; // CCW: right normal points out of the loop
  }
  const SMOOTH = Math.cos(15 * DEG);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const e0 = edgeN[i0], e1 = edgeN[i];
    const cosTurn = e0[0] * e1[0] + e0[1] * e1[1];
    const turnLeft = edgeD[i0][0] * edgeD[i][1] - edgeD[i0][1] * edgeD[i][0] > 0;
    const diverging = isHole ? turnLeft : !turnLeft;
    if (diverging && cosTurn < SMOOTH) {
      const ang = Math.acos(Math.max(-1, Math.min(1, cosTurn)));
      const a0 = Math.atan2(e0[1], e0[0]);
      let da = Math.atan2(e1[1], e1[0]) - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.max(2, Math.ceil(ang / (10 * DEG)));
      for (let j = 0; j <= k; j++) {
        const a = a0 + da * j / k, d = [Math.cos(a), Math.sin(a)];
        frames.push({ p: pts[i], inset: [-d[0], -d[1]], d: [d] });
      }
      continue;
    }
    let ax = e0[0] + e1[0], ay = e0[1] + e1[1];
    const al = Math.hypot(ax, ay);
    if (al < 1e-9) { ax = e1[0]; ay = e1[1]; } else { ax /= al; ay /= al; }
    const c = Math.max(0.1, ax * e1[0] + ay * e1[1]); // miter, limit 10
    const inset = [-ax / c, -ay / c];
    frames.push({ p: pts[i], inset, d: cosTurn < creaseCos ? [e0, e1] : [[ax, ay]] });
  }
  return frames;
}

// True if the offset contours (the flat faces' outlines) neither cross each
// other nor fold over themselves.
function contoursValid(contours) {
  const segs = [];
  contours.forEach((c, ci) => {
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-7) segs.push({ a, b, ci, i, n: c.length });
    }
  });
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const s of segs) for (const p of [s.a, s.b]) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
  const cell = Math.max(0.5, Math.sqrt(((hi[0] - lo[0]) * (hi[1] - lo[1])) / Math.max(1, segs.length)) * 2);
  const grid = new Map();
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    const x0 = Math.floor((Math.min(s.a[0], s.b[0]) - lo[0]) / cell), x1 = Math.floor((Math.max(s.a[0], s.b[0]) - lo[0]) / cell);
    const y0 = Math.floor((Math.min(s.a[1], s.b[1]) - lo[1]) / cell), y1 = Math.floor((Math.max(s.a[1], s.b[1]) - lo[1]) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = x * 100003 + y;
      const list = grid.get(key);
      if (list) {
        for (const j of list) {
          const t = segs[j];
          if (t.ci === s.ci) { // neighbours along the same contour share an end
            const d = Math.abs(t.i - s.i);
            if (d <= 1 || d >= s.n - 1) continue;
          }
          const d1 = cross(s.a, s.b, t.a), d2 = cross(s.a, s.b, t.b), d3 = cross(t.a, t.b, s.a), d4 = cross(t.a, t.b, s.b);
          if (((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12))) return false;
        }
        list.push(k);
      } else grid.set(key, [k]);
    }
  }
  return true;
}

// ── Mesh ─────────────────────────────────────────────────────────────────

function chooseRadius(loopsFrames, rStart, rMin = 0.3) {
  // Same step-down as replicad-pipeline's filletShape: x0.65, at most 8 tries.
  let r = rStart;
  for (let attempt = 0; attempt < 8 && r >= rMin; attempt++) {
    const contours = loopsFrames.map(fr => fr.map(f => [f.p[0] + f.inset[0] * r, f.p[1] + f.inset[1] * r]));
    if (contoursValid(contours)) return r;
    r *= 0.65;
  }
  return 0;
}

function roundedSlab(data, options, forExport) {
  const {
    thickness = 5,
    filletR = 2,
    minFeature = Infinity,   // narrowest wire/border if known; caps r up front
    tolerance = forExport ? 0.005 : 0.01,
    maxArcStep = 6 * DEG,
    profileSteps = forExport ? 16 : 8,
    creaseDeg = 30,
    minFilletR = 0.3,        // give up on the fillet below this (model units)
  } = options;

  // `options.loops` skips the pendant outline: any counter-clockwise loops,
  // the outer boundary first and its holes after (see buildMeshFromLoops).
  const loops = options.loops || outlineLoops(data, tolerance, maxArcStep);
  const creaseCos = forExport ? -2 : Math.cos(creaseDeg * DEG); // export: one normal per point, so it welds
  const frames = loops.map(L => loopFrames(L.pts, L.hole, creaseCos));
  const r0 = Math.max(0, Math.min(filletR, thickness / 2 - 0.1, minFeature * 0.45));
  const rf = r0 > 0 ? chooseRadius(frames, r0, minFilletR) : 0;

  const pos = [], nor = [], idx = [];
  const addV = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };

  // profile: bottom fillet (phi 90 -> 0), wall, top fillet (phi 0 -> 90)
  const prof = [];
  const steps = rf > 0 ? profileSteps : 0;
  for (let k = steps; k >= 0; k--) {
    const phi = (k / Math.max(1, steps)) * Math.PI / 2;
    prof.push({ off: rf * (1 - Math.cos(phi)), z: rf - rf * Math.sin(phi), c: Math.cos(phi), s: -Math.sin(phi) });
  }
  for (let k = 0; k <= steps; k++) {
    const phi = (k / Math.max(1, steps)) * Math.PI / 2;
    prof.push({ off: rf * (1 - Math.cos(phi)), z: thickness - rf + rf * Math.sin(phi), c: Math.cos(phi), s: Math.sin(phi) });
  }

  const capContours = [];
  loops.forEach((L, li) => {
    const fr = frames[li];
    const cols = [];
    for (const f of fr) {
      for (let j = 0; j < f.d.length; j++) {
        const d = f.d[j], col = [];
        for (const pr of prof) {
          let nx = d[0] * pr.c, ny = d[1] * pr.c, nz = pr.s;
          const nl = Math.hypot(nx, ny, nz) || 1;
          col.push(addV(f.p[0] + f.inset[0] * pr.off, f.p[1] + f.inset[1] * pr.off, pr.z, nx / nl, ny / nl, nz / nl));
        }
        cols.push({ col, twin: j === 1 });
      }
    }
    for (let i = 0; i < cols.length; i++) {
      const A = cols[i], B = cols[(i + 1) % cols.length];
      if (B.twin) continue; // zero-width strip between the two normals of a crease
      for (let k = 0; k < prof.length - 1; k++) {
        const a0 = A.col[k], a1 = A.col[k + 1], b0 = B.col[k], b1 = B.col[k + 1];
        if (L.hole) idx.push(a0, a1, b0, b0, a1, b1);
        else idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    capContours.push(fr.map(f => [f.p[0] + f.inset[0] * rf, f.p[1] + f.inset[1] * rf]));
  });

  // flat faces
  const flat = [], holes = [];
  capContours.forEach((c, i) => { if (i > 0) holes.push(flat.length / 2); for (const p of c) flat.push(p[0], p[1]); });
  const tris = Earcut.triangulate(flat, holes, 2);
  for (const [z, nz] of [[thickness, 1], [0, -1]]) {
    const base = pos.length / 3;
    for (let i = 0; i < flat.length; i += 2) addV(flat[i], flat[i + 1], z, 0, 0, nz);
    for (let t = 0; t < tris.length; t += 3) {
      let a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const area = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) -
                   (flat[2 * c] - flat[2 * a]) * (flat[2 * b + 1] - flat[2 * a + 1]);
      if ((area < 0) === (nz > 0)) { const tmp = b; b = c; c = tmp; }
      idx.push(base + a, base + b, base + c);
    }
  }
  return { pos, nor, idx, filletR: rf };
}

// Indexed mesh with normals for the Three.js viewer.
export function buildPreviewMesh(data, options = {}) {
  const m = roundedSlab(data, options, false);
  return { vertices: new Float32Array(m.pos), normals: new Float32Array(m.nor), triangles: new Uint32Array(m.idx), filletR: m.filletR };
}

// Welded, closed mesh for export (vertices closer than 0.0001 merged, degenerate
// triangles dropped). Genus equals the number of voids.
export function buildPendantMesh(data, options = {}) {
  const m = roundedSlab(data, options, true);
  const eps = 1e-4, map = new Map(), remap = new Uint32Array(m.pos.length / 3), V = [];
  for (let i = 0; i < remap.length; i++) {
    const x = m.pos[3 * i], y = m.pos[3 * i + 1], z = m.pos[3 * i + 2];
    const key = Math.round(x / eps) + ',' + Math.round(y / eps) + ',' + Math.round(z / eps);
    let j = map.get(key);
    if (j === undefined) { j = V.length / 3; map.set(key, j); V.push(x, y, z); }
    remap[i] = j;
  }
  const T = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = remap[m.idx[t]], b = remap[m.idx[t + 1]], c = remap[m.idx[t + 2]];
    if (a !== b && b !== c && a !== c) T.push(a, b, c);
  }
  return { vertices: new Float32Array(V), triangles: new Uint32Array(T), filletR: m.filletR };
}

// Binary STL. `scale` converts model units to millimetres if needed.
export function meshToSTL(mesh, { scale = 1, header = 'Constelier pendant' } = {}) {
  const V = mesh.vertices, T = mesh.triangles, n = T.length / 3;
  const buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
  for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i) & 127);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const a = 3 * T[3 * t], b = 3 * T[3 * t + 1], c = 3 * T[3 * t + 2];
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, v, true); o += 4; }
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) { dv.setFloat32(o, V[i + k] * scale, true); o += 4; }
    o += 2;
  }
  return buf;
}

// The plain ring shown while the full pendant is being built.
export function buildRingPreviewMesh(circleRadius, borderThickness, options = {}) {
  return buildPreviewMesh({
    circleRadius, borderThickness,
    voidChains: [{ links: [{ type: 'arc', origin: [0, 0], radius: circleRadius, startAngle: 0, endAngle: 360, reversed: false }] }],
  }, { minFeature: borderThickness, ...options });
}

// A rounded slab from plain polygons instead of pendant outline data: `outer`
// is the boundary, `holes` go through it (each a list of [x, y], any winding).
// Same options and output as buildPreviewMesh.
export function buildMeshFromLoops(outer, holes = [], options = {}) {
  const ccw = pts => (signedArea(pts) < 0 ? pts.slice().reverse() : pts);
  const loops = [{ hole: false, pts: ccw(outer) }, ...holes.map(h => ({ hole: true, pts: ccw(h) }))];
  return buildPreviewMesh(null, { ...options, loops });
}
