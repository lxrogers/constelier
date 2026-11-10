// modules/prototypes/big3-ring.js
//
// "Big three" ring prototype: a band that carries the ascendant, sun and moon
// at their natal chart positions. Looking down the ring's axis it reads like
// a tiny chart (ascendant on the left, the zodiac running counter-clockwise).
//
// The shapes lie on the band's outer face, following its curve and flush with
// it: seen face-on, the band simply widens into a disc, a star, a crescent.
// The ring is drawn flat first - the band as a strip, the shapes unioned onto
// it, holes cut through - then that pattern is given the band's thickness
// with fast-pendant-mesh (rounded edges, no OpenCascade) and wrapped round.
//
// Pure geometry and chart maths: no DOM, no React, no Three.js scene.
// Lengths are millimetres. Angles on the ring use the chart canvas convention:
// 0 = right, 90 = down the screen, 180 = left.

import polygonClipping from 'polygon-clipping';
import { buildMeshFromLoops } from '../fast-pendant-mesh.js';

const DEG = Math.PI / 180;

export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export const ASC_STYLES = [
  { key: 'bar', label: 'Bar' },
  { key: 'gap', label: 'Gap' },
  { key: 'triangle', label: 'Triangle' },
];
export const SUN_STYLES = [
  { key: 'halo', label: 'Halo' },
  { key: 'radiant', label: 'Radiant' },
  { key: 'star', label: 'Star' },
];
export const MOON_STYLES = [
  { key: 'full', label: 'Full' },
  { key: 'crescent', label: 'Crescent' },
  { key: 'hex', label: 'Hex' },
];

// US size 7 or so: 17.2 mm across the finger.
export const RING = { innerR: 8.6, wall: 1.8 };
export const RING_OUTER_R = RING.innerR + RING.wall;

// Keep-clear distances (degrees around the ring). Closer than this the sun
// and moon would swallow each other; at this distance they just overlap.
export const BODY_GAP_DEG = 21;
export const ASC_GAP_DEG = 17;

// ── Chart ────────────────────────────────────────────────────────────────

export function normDeg(d) { return ((d % 360) + 360) % 360; }

// Shortest way round from `from` to `to`, t in 0..1.
export function lerpAngle(from, to, t) {
  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return normDeg(from + diff * t);
}

function chartPoint(body) {
  const deg = normDeg(body.ChartPosition.Ecliptic.DecimalDegrees);
  const signIndex = Math.floor(deg / 30) % 12;
  return {
    deg,
    signIndex,
    sign: SIGN_NAMES[signIndex],
    degInSign: deg - signIndex * 30,
    house: body.House ? body.House.id : null,
  };
}

// Ascendant, sun and moon out of a circular-natal-horoscope-js Horoscope.
export function big3FromHoroscope(h) {
  return {
    asc: chartPoint(h.Ascendant),
    sun: chartPoint(h.CelestialBodies.sun),
    moon: chartPoint(h.CelestialBodies.moon),
  };
}

// Where the sun and moon sit on the ring, in degrees of zodiac past the
// ascendant (-180..180). True positions, nudged apart only as far as needed
// for the shapes to clear each other and the ascendant mark.
export function layoutOffsets(big3, bodyGap = BODY_GAP_DEG, ascGap = ASC_GAP_DEG) {
  const rel = d => ((d - big3.asc.deg) % 360 + 540) % 360 - 180;
  const s0 = rel(big3.sun.deg), m0 = rel(big3.moon.deg);
  const clearAsc = x => (Math.abs(x) >= ascGap ? x : (x >= 0 ? ascGap : -ascGap));
  let s = clearAsc(s0), m = clearAsc(m0);

  let diff = m - s;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  if (Math.abs(diff) < bodyGap) {
    let d0 = m0 - s0;
    if (d0 > 180) d0 -= 360;
    if (d0 <= -180) d0 += 360;
    const dir = diff !== 0 ? Math.sign(diff) : (d0 >= 0 ? 1 : -1);
    const push = (bodyGap - Math.abs(diff)) / 2;
    s -= dir * push;
    m += dir * push;
    // pushing apart may have moved one back onto the ascendant: slide both off
    const fix = x => (Math.abs(x) < ascGap ? (x >= 0 ? ascGap : -ascGap) - x : 0);
    const shift = fix(s) || fix(m);
    s += shift;
    m += shift;
  }
  return { sun: s, moon: m };
}

// Zodiac degrees past the ascendant -> angle on the ring (radians).
export function offsetToAngle(offsetDeg) {
  return (180 - offsetDeg) * DEG;
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

export function formatPosition(p) {
  return `${p.sign} ${Math.floor(p.degInSign)}°`;
}
export function formatHouse(p) {
  return p.house ? `${ORDINALS[p.house] || p.house} house` : '';
}

// ── Flat pattern ─────────────────────────────────────────────────────────
// Shapes are drawn in (u, v): u runs along the band, v across it, with v < 0
// the edge that faces the viewer when the ring lies flat.

function circle(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Points alternating between the radii in `radii`, first one straight up.
function starburst(radii, points) {
  const pts = [], n = points * radii.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2, r = radii[i % radii.length];
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

// Replace every corner with an arc of radius `r` (less where the edges are
// too short for it), so tips can be cast and the 3D edge fillet has room.
function roundCorners(pts, r, steps = 5) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n], B = pts[i], C = pts[(i + 1) % n];
    const la = Math.hypot(A[0] - B[0], A[1] - B[1]), lc = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const u = [(A[0] - B[0]) / la, (A[1] - B[1]) / la], v = [(C[0] - B[0]) / lc, (C[1] - B[1]) / lc];
    const theta = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (theta > Math.PI - 0.05) { out.push(B); continue; }
    const tan = Math.tan(theta / 2);
    const t = Math.min(r / tan, 0.45 * Math.min(la, lc)), rr = t * tan;
    let bx = u[0] + v[0], by = u[1] + v[1];
    const bl = Math.hypot(bx, by);
    bx /= bl; by /= bl;
    const d = rr / Math.sin(theta / 2), cx = B[0] + bx * d, cy = B[1] + by * d;
    const a0 = Math.atan2(B[1] + u[1] * t - cy, B[0] + u[0] * t - cx);
    let da = Math.atan2(B[1] + v[1] * t - cy, B[0] + v[0] * t - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= steps; k++) out.push([cx + rr * Math.cos(a0 + da * k / steps), cy + rr * Math.sin(a0 + da * k / steps)]);
  }
  return out;
}

const CORNER_R = 0.36;

// { outer, holes, halfU } for one marker, centred on its spot on the band;
// null when the style has no shape of its own (the gap). `halfU` is how far
// it reaches along the band.
export function markerProfile(kind, style, size = 1, width = 2.6) {
  const s = size;
  if (kind === 'sun') {
    if (style === 'radiant') {
      const tip = 2.8 * s;
      return { outer: roundCorners(starburst([tip, 1.95 * s], 12), CORNER_R), holes: [circle(0, 0, 0.5 * s, 28)], halfU: tip };
    }
    if (style === 'star') {
      const tip = 2.9 * s;
      return { outer: roundCorners(starburst([tip, 1.2 * s, 2.05 * s, 1.2 * s], 4), CORNER_R), holes: [], halfU: tip };
    }
    const r = 2.4 * s;
    return { outer: circle(0, 0, r, 72), holes: [circle(0, 0, 0.9 * s, 40)], halfU: r };
  }

  if (kind === 'moon') {
    if (style === 'hex') {
      const r = 2.35 * s;
      return { outer: roundCorners(starburst([r], 6), CORNER_R), holes: [], halfU: r * Math.cos(Math.PI / 6) };
    }
    if (style === 'crescent') {
      // a disc with a bite out of its upper side, each horn ending in a small
      // round cap tangent to both circles
      const R = 2.4 * s, r = 1.75 * s, d = 1.25 * s, cap = 0.32 * s;
      const px = (d * d + (R - cap) ** 2 - (r + cap) ** 2) / (2 * d), py = Math.sqrt((R - cap) ** 2 - px * px);
      const a1 = Math.atan2(py, px), b1 = Math.atan2(py, px - d);
      const pts = [];
      // drawn with the bite toward +x, then turned to face up (-v)
      const arc = (cx, cy, rad, from, to, n) => {
        for (let i = 0; i < n; i++) { const a = from + (to - from) * (i / n), x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a); pts.push([y, -x]); }
      };
      arc(0, 0, R, a1, 2 * Math.PI - a1, 48);
      arc(px, -py, cap, -a1, -b1 + Math.PI, 8);
      arc(d, 0, r, 2 * Math.PI - b1, b1, 32);
      arc(px, py, cap, b1 - Math.PI, a1, 8);
      return { outer: pts, holes: [], halfU: R };
    }
    const r = 2.15 * s;
    return { outer: circle(0, 0, r, 64), holes: [], halfU: r };
  }

  // ascendant
  if (style === 'gap') return null;
  if (style === 'triangle') {
    // sits on the band's lower edge and points up
    const half = 2.3 * s, base = width / 2, apex = -(width / 2 + 2.1 * s);
    return { outer: roundCorners([[-half, base], [0, apex], [half, base]], CORNER_R), holes: [], halfU: half };
  }
  // bar: a stadium standing across the band
  const w = 0.75 * s, h = width / 2 + 1.5 * s;
  return { outer: roundCorners([[-w, -h], [w, -h], [w, h], [-w, h]], w * 0.98, 8), holes: [], halfU: w };
}

// A hole has to go through the band as well, so a sun with one is part of
// the band's own mesh: `core` is the smooth disc that carries the hole. What
// is left to draw on top (the rays) is `overlay`. Suns without a hole are all
// overlay, like the moon and the ascendant mark.
function sunParts(style, size, width) {
  const p = markerProfile('sun', style, size, width);
  if (!p.holes.length) return { core: null, overlay: p };
  if (style === 'radiant') return { core: { outer: circle(0, 0, 1.95 * size, 64), holes: p.holes }, overlay: p };
  return { core: p, overlay: null };
}

// How far the ring reaches either side of the band's centre line.
export function ringHalfHeight(design) {
  let half = design.width / 2;
  for (const kind of ['asc', 'sun', 'moon']) {
    const p = markerProfile(kind, design[kind], design.size, design.width);
    if (p) for (const q of p.outer) half = Math.max(half, Math.abs(q[1]));
  }
  return half;
}

// ── Mesh ─────────────────────────────────────────────────────────────────
// Every mesh is drawn flat first: x is millimetres along the outer face,
// starting at the ascendant and running with the zodiac, y is across the band.

const LENGTH = 2 * Math.PI * RING_OUTER_R;
const BEND_STEP = RING_OUTER_R * 3 * DEG; // longest run along the band between mesh points
const GAP_MM = 2.2;                       // clear opening of the gap style, on the outer face
const BAND_FILLET = 0.7;                  // of a 1.8 mm wall: a soft, almost oval section

// Cut every triangle that spans more than `maxDx` along x into a ladder of
// narrow ones, so the flat mesh can be bent without cutting corners. Each
// edge is divided the same way whichever triangle asks, so neighbours stay
// joined. Adds vertices to `pos` / `nor`; returns the new triangle list.
function splitForBend(pos, nor, tris, maxDx) {
  const cache = new Map(), out = [];
  const edge = (a, b) => {
    const k = Math.ceil(Math.abs(pos[3 * a] - pos[3 * b]) / maxDx - 1e-9);
    if (k <= 1) return [a, b];
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo * 16777216 + hi;
    let pts = cache.get(key);
    if (!pts) {
      pts = [lo];
      for (let j = 1; j < k; j++) {
        const t = j / k, u = 1 - t;
        pts.push(pos.length / 3);
        pos.push(pos[3 * lo] * u + pos[3 * hi] * t, pos[3 * lo + 1] * u + pos[3 * hi + 1] * t, pos[3 * lo + 2] * u + pos[3 * hi + 2] * t);
        const nx = nor[3 * lo] * u + nor[3 * hi] * t, ny = nor[3 * lo + 1] * u + nor[3 * hi + 1] * t, nz = nor[3 * lo + 2] * u + nor[3 * hi + 2] * t;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / nl, ny / nl, nz / nl);
      }
      pts.push(hi);
      cache.set(key, pts);
    }
    return a === lo ? pts : pts.slice().reverse();
  };
  const normalZ = (a, b, c) => { // enough to tell which way a triangle faces, with a fallback for walls
    const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
    const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };

  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const [A, B, C] = [a, b, c].sort((p, q) => pos[3 * p] - pos[3 * q]);
    const far = edge(A, C), near = edge(A, B).concat(edge(B, C).slice(1));
    if (far.length === 2 && near.length === 3) { out.push(a, b, c); continue; }
    const n0 = normalZ(a, b, c);
    const emit = (p, q, r) => {
      if (p === q || q === r || p === r) return;
      const n = normalZ(p, q, r);
      if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] < 0) out.push(p, r, q); else out.push(p, q, r);
    };
    // walk both sides from A to C, always stepping on the side that is behind
    let i = 0, j = 0;
    while (i < far.length - 1 || j < near.length - 1) {
      const stepFar = j === near.length - 1 || (i < far.length - 1 && pos[3 * far[i + 1]] <= pos[3 * near[j + 1]]);
      if (stepFar) { emit(far[i], far[i + 1], near[j]); i++; } else { emit(far[i], near[j + 1], near[j]); j++; }
    }
  }
  return out;
}

// Polygons ({ outer, holes }, flat) -> a mesh wrapped round the ring's axis:
// thickness becomes radius, x becomes angle (the ascendant at 180 degrees,
// zodiac order counter-clockwise on screen), y runs along the axis with y < 0
// toward the viewer. Top and bottom edges are rounded by `filletR`.
function wrapPattern(polygons, filletR) {
  const pos = [], nor = [];
  let tris = [];
  for (const poly of polygons) {
    // points along long edges first, so the walls bend smoothly
    const dense = ring => {
      const out = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const k = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / BEND_STEP));
        for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
      }
      return out;
    };
    const m = buildMeshFromLoops(dense(poly.outer), poly.holes.map(dense), {
      thickness: RING.wall, filletR, minFilletR: 0.05, tolerance: 0.004, profileSteps: 7,
    });
    const base = pos.length / 3;
    for (let i = 0; i < m.vertices.length; i++) { pos.push(m.vertices[i]); nor.push(m.normals[i]); }
    for (let i = 0; i < m.triangles.length; i++) tris.push(m.triangles[i] + base);
  }
  tris = splitForBend(pos, nor, tris, BEND_STEP * 1.05);

  const n = pos.length / 3;
  const vertices = new Float32Array(pos.length), normals = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) {
    const a = Math.PI - pos[3 * i] / RING_OUTER_R, rho = RING.innerR + pos[3 * i + 2];
    const ca = Math.cos(a), sa = Math.sin(a);
    vertices[3 * i] = rho * ca; vertices[3 * i + 1] = rho * sa; vertices[3 * i + 2] = pos[3 * i + 1];
    const nx = nor[3 * i], ny = nor[3 * i + 1], nz = nor[3 * i + 2];
    normals[3 * i] = nx * sa + nz * ca; normals[3 * i + 1] = -nx * ca + nz * sa; normals[3 * i + 2] = ny;
  }
  // the wrap mirrors the pattern, so the triangles turn the other way
  const triangles = new Uint32Array(tris.length);
  for (let t = 0; t < tris.length; t += 3) { triangles[t] = tris[t]; triangles[t + 1] = tris[t + 2]; triangles[t + 2] = tris[t + 1]; }
  return { vertices, normals, triangles };
}

const shifted = (ring, dx) => ring.map(q => [q[0] + dx, q[1]]);
const openRing = ring => ring.slice(0, -1); // polygon-clipping repeats the first point

// True when the band has to be rebuilt as the sun moves: the sun's hole goes
// through the band, and the gap stops the band from simply turning with it.
export function bandFollowsSun(design) {
  return design.asc === 'gap' && !!sunParts(design.sun, design.size, design.width).core;
}

// The band, with the sun's holed disc (if it has one) at `sunOffDeg` past the
// ascendant. Without a gap the band is the same all the way round, so build
// it once with the sun anywhere and turn the mesh to move the sun.
export function buildBandMesh(design, sunOffDeg = 180) {
  const hw = design.width / 2, gap = design.asc === 'gap';
  const strip = gap
    ? roundCorners([[GAP_MM / 2, -hw], [LENGTH - GAP_MM / 2, -hw], [LENGTH - GAP_MM / 2, hw], [GAP_MM / 2, hw]], hw * 0.98, 8)
    : [[-1.2, -hw], [LENGTH + 1.2, -hw], [LENGTH + 1.2, hw], [-1.2, hw]]; // the ends overlap, so the join is buried
  const { core } = sunParts(design.sun, design.size, design.width);
  if (!core) return wrapPattern([{ outer: strip, holes: [] }], BAND_FILLET);

  const x0 = normDeg(sunOffDeg) * DEG * RING_OUTER_R;
  let metal = polygonClipping.union([strip], [shifted(core.outer, x0)]);
  metal = polygonClipping.difference(metal, ...core.holes.map(h => [shifted(h, x0)]));
  return wrapPattern(metal.map(poly => ({ outer: openRing(poly[0]), holes: poly.slice(1).map(openRing) })), BAND_FILLET);
}

// One marker as its own mesh, lying on the band at 180 degrees past the
// ascendant (the right-hand side): turn it about the axis to place it.
// null when there is nothing to add to the band (the gap, the halo sun).
export function buildMarkerMesh(kind, design) {
  const p = kind === 'sun'
    ? sunParts(design.sun, design.size, design.width).overlay
    : markerProfile(kind, design[kind], design.size, design.width);
  if (!p) return null;
  return wrapPattern([{ outer: shifted(p.outer, LENGTH / 2), holes: p.holes.map(h => shifted(h, LENGTH / 2)) }], BAND_FILLET);
}
