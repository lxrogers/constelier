// modules/fast-pendant-mesh.js
//
// Builds the preview mesh for the pendant straight from the 2D outline, with
// no OpenCascade. The result looks like the BREP pipeline's output (extruded
// disc, voids cut through, top and bottom edges rounded with a quarter-circle
// fillet) but takes milliseconds instead of seconds and needs no 11 MB WASM.
//
// Input is the same `serializeChainsFor3D()` data the BREP pipeline takes, so
// any outline algorithm that produces void chains works unchanged.
// OpenCascade stays the source of truth for the casting export (STEP/STL).
//
// Output: { vertices: Float32Array, normals: Float32Array, triangles: Uint32Array }
// in the same coordinate frame as replicad's mesh (z = 0 .. thickness).

import { Earcut } from 'three/src/extras/Earcut.js';

const DEG = Math.PI / 180;

function linkStart(l) {
  if (l.type === 'line') return l.reversed ? l.end : l.origin;
  const a = (l.reversed ? l.endAngle : l.startAngle) * DEG;
  return [l.origin[0] + l.radius * Math.cos(a), l.origin[1] + l.radius * Math.sin(a)];
}

// Sample one closed chain into a polyline. Lines keep only their endpoints,
// arcs are split so the chord error stays under `tol`.
function sampleChain(links, tol, maxStep) {
  const pts = [];
  for (const l of links) {
    if (l.type === 'line') {
      pts.push(linkStart(l));
    } else if (l.type === 'arc') {
      let span = l.endAngle - l.startAngle;
      while (span <= 0) span += 360;
      span *= DEG;
      const step = Math.min(maxStep, 2 * Math.acos(Math.max(-1, 1 - tol / l.radius)) || maxStep);
      const n = Math.max(1, Math.ceil(span / step));
      const a0 = l.startAngle * DEG;
      for (let i = 0; i < n; i++) {
        const t = l.reversed ? 1 - i / n : i / n;
        const a = a0 + span * t;
        pts.push([l.origin[0] + l.radius * Math.cos(a), l.origin[1] + l.radius * Math.sin(a)]);
      }
    }
  }
  // drop near-duplicates (including the wrap-around)
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

// For each polyline point: `inset` (vector pointing into the material, sized
// so that inset * r is the boundary offset by r) and one or two shading
// normals `d` (unit, pointing out of the material).
//
// Corners where the offset curves converge get an exact miter (and, if
// sharper than `creaseDeg`, two normals so they shade as a crisp edge).
// Corners where they diverge (a void's sharp tip, seen from the material) get
// a round join: several frames sweeping between the two edge normals, which
// is exactly what a rolling-ball fillet does there and never self-intersects.
function loopFrame(pts, isHole, creaseCos) {
  const n = pts.length;
  const edgeN = new Array(n); // outward normal of edge i -> i+1
  const edgeD = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    edgeD[i] = [dx, dy];
    // loops are CCW: right normal points out of the loop, left normal into it
    edgeN[i] = isHole ? [-dy, dx] : [dy, -dx];
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
      let a1 = Math.atan2(e1[1], e1[0]);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.max(2, Math.ceil(ang / (10 * DEG)));
      for (let j = 0; j <= k; j++) {
        const a = a0 + da * j / k;
        const d = [Math.cos(a), Math.sin(a)];
        frames.push({ p: pts[i], inset: [-d[0], -d[1]], d: [d] });
      }
      continue;
    }
    let ax = e0[0] + e1[0], ay = e0[1] + e1[1];
    const al = Math.hypot(ax, ay);
    if (al < 1e-9) { ax = e1[0]; ay = e1[1]; } else { ax /= al; ay /= al; }
    const c = Math.max(0.1, ax * e1[0] + ay * e1[1]); // miter, limit 10
    const inset = [-ax / c, -ay / c];
    if (cosTurn < creaseCos) frames.push({ p: pts[i], inset, d: [e0, e1] });
    else frames.push({ p: pts[i], inset, d: [[ax, ay]] });
  }
  return frames;
}

export function buildPreviewMesh(data, options = {}) {
  const {
    thickness = 5,
    filletR = 2,
    minFeature = Infinity,  // narrowest bar/border width; caps the fillet like OCC's step-down
    tolerance = 0.01,       // chord error for arcs, model units
    maxArcStep = 6 * DEG,
    profileSteps = 8,       // segments per quarter-circle fillet
    creaseDeg = 30,
  } = options;

  const rf = Math.max(0, Math.min(filletR, thickness / 2 - 0.1, minFeature * 0.45));
  const creaseCos = Math.cos(creaseDeg * DEG);
  const outerR = data.circleRadius + data.borderThickness;

  // loops: outer circle (material inside) + voids (material outside)
  const loops = [];
  loops.push({
    hole: false,
    pts: sampleChain([{ type: 'arc', origin: [0, 0], radius: outerR, startAngle: 0, endAngle: 360, reversed: false }], tolerance, maxArcStep),
  });
  for (const ch of data.voidChains) {
    const pts = sampleChain(ch.links, tolerance, maxArcStep);
    if (pts.length < 3) continue;
    loops.push({ hole: true, pts });
  }
  for (const L of loops) if (signedArea(L.pts) < 0) L.pts.reverse();

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

  const capContours = []; // inset-by-rf polylines for the flat caps
  for (const L of loops) {
    const frames = loopFrame(L.pts, L.hole, creaseCos);
    // column = one vertical strip of profile vertices; a crease point gives two
    const cols = [];
    for (const f of frames) {
      for (let j = 0; j < f.d.length; j++) {
        const d = f.d[j];
        const col = [];
        for (const pr of prof) {
          const x = f.p[0] + f.inset[0] * pr.off, y = f.p[1] + f.inset[1] * pr.off;
          let nx = d[0] * pr.c, ny = d[1] * pr.c, nz = pr.s;
          const nl = Math.hypot(nx, ny, nz) || 1;
          col.push(addV(x, y, pr.z, nx / nl, ny / nl, nz / nl));
        }
        cols.push({ col, twin: j === 1 });
      }
    }
    for (let i = 0; i < cols.length; i++) {
      const A = cols[i], B = cols[(i + 1) % cols.length];
      if (B.twin) continue; // zero-width strip between the two normals of a crease
      for (let k = 0; k < prof.length - 1; k++) {
        const a0 = A.col[k], a1 = A.col[k + 1], b0 = B.col[k], b1 = B.col[k + 1];
        // walking CCW along an outer loop, material is on the left; flip for holes
        if (L.hole) idx.push(a0, a1, b0, b0, a1, b1);
        else idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    capContours.push(frames.map(f => [f.p[0] + f.inset[0] * rf, f.p[1] + f.inset[1] * rf]));
  }

  // flat caps
  const flat = [], holes = [];
  for (let i = 0; i < capContours.length; i++) {
    if (i > 0) holes.push(flat.length / 2);
    for (const p of capContours[i]) flat.push(p[0], p[1]);
  }
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

  return {
    vertices: new Float32Array(pos),
    normals: new Float32Array(nor),
    triangles: new Uint32Array(idx),
    filletR: rf,
  };
}

// The plain ring shown while the full pendant is being built.
export function buildRingPreviewMesh(circleRadius, borderThickness, options = {}) {
  return buildPreviewMesh({
    circleRadius, borderThickness,
    voidChains: [{ links: [{ type: 'arc', origin: [0, 0], radius: circleRadius, startAngle: 0, endAngle: 360, reversed: false }] }],
  }, { minFeature: borderThickness, ...options });
}
