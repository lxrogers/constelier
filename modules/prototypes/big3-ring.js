// modules/prototypes/big3-ring.js
//
// "Big three" ring prototype: a band that carries the ascendant, sun and moon
// at their natal chart positions. Looking down the ring's axis it reads like
// a tiny chart (ascendant on the left, the zodiac running counter-clockwise).
//
// The shapes lie on the band's outer face, following its curve and flush with
// it: seen face-on, the band simply widens into a disc, a star, a crescent.
// Each is as thick as the band and can be raised a little from its face
// (`relief`, 0 for flush). Band and shapes are drawn flat first, given their
// thickness with fast-pendant-mesh (rounded edges, no OpenCascade), then
// wrapped round the ring's axis.
//
// Two ways to draw the same ring. While the sun and moon move, the band and
// each shape are separate meshes that only turn about the axis (cheap, but
// they overlap, and overlapping faces never match to the micron). At rest,
// buildWholeMesh() makes the band and its shapes one continuous piece.
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
  { key: 'rays', label: 'Fine rays' },
  { key: 'open', label: 'Open sun' },
  { key: 'burst', label: 'Starburst' },
  { key: 'rising', label: 'Rising' },
  { key: 'halo', label: 'Halo' },
  { key: 'star', label: 'Star' },
];
export const MOON_STYLES = [
  { key: 'side', label: 'Crescent' },
  { key: 'eclipse', label: 'Eclipse' },
  { key: 'crescent', label: 'Cradle' },
  { key: 'full', label: 'Full' },
  { key: 'hex', label: 'Hex' },
];

// US size 7 or so: 17.2 mm across the finger.
// US size 7 or so: 17.2 mm across the finger. The wall is the design's
// `thickness`; the pattern is laid out on the band's outer face.
export const RING = { innerR: 8.6 };
export const ringOuterR = design => RING.innerR + design.thickness;

// Keep-clear distances (degrees around the ring) when nothing better is
// known; layoutGaps() works them out from the shapes in a design.
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

// Replace every corner with an arc of radius `r` (one radius, or one per
// corner; less where the edges are too short for it), so tips can be cast and the 3D edge fillet has room.
function roundCorners(pts, r, steps = 5) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n], B = pts[i], C = pts[(i + 1) % n];
    const la = Math.hypot(A[0] - B[0], A[1] - B[1]), lc = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const u = [(A[0] - B[0]) / la, (A[1] - B[1]) / la], v = [(C[0] - B[0]) / lc, (C[1] - B[1]) / lc];
    const theta = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (theta > Math.PI - 0.05) { out.push(B); continue; }
    const tan = Math.tan(theta / 2);
    const want = Array.isArray(r) ? r[i] : r;
    if (!(want > 0)) { out.push(B); continue; }
    const t = Math.min(want / tan, 0.45 * Math.min(la, lc)), rr = t * tan;
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

// A disc of radius R that runs into the band (half-width hw) through four
// small fillets of radius f, one in each corner where the disc's edge would
// otherwise meet the band's at an angle. The outline carries the short piece
// of band between the fillets, so the blend is part of the shape and travels
// with it. Returns the outline and how far it reaches along the band.
function blendedDisc(R, hw, f) {
  if (R <= hw + 0.05) return { outer: circle(0, 0, R, 72), halfU: R };
  const cx = Math.sqrt((R + f) ** 2 - (hw + f) ** 2), cy = hw + f;
  const t = Math.atan2(cy, cx); // where the disc hands over to a fillet
  const pts = [];
  const arc = (ox, oy, rad, from, to, n) => { // the short way round, end point left to the next piece
    let d = to - from;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    for (let i = 0; i < n; i++) { const a = from + d * (i / n); pts.push([ox + rad * Math.cos(a), oy + rad * Math.sin(a)]); }
  };
  arc(0, 0, R, t, Math.PI - t, 40);                                  // lower lobe
  arc(-cx, cy, f, Math.atan2(-cy, cx), -Math.PI / 2, 8);
  pts.push([-cx, hw]);                                               // straight across the band
  arc(-cx, -cy, f, Math.PI / 2, Math.atan2(cy, cx), 8);
  arc(0, 0, R, Math.PI + t, 2 * Math.PI - t, 40);                    // upper lobe
  arc(cx, -cy, f, Math.atan2(cy, -cx), Math.PI / 2, 8);
  pts.push([cx, -hw]);
  arc(cx, cy, f, -Math.PI / 2, Math.atan2(-cy, -cx), 8);
  return { outer: pts, halfU: Math.max(R, cx) };
}
const BLEND_R = 0.6;

// { outer, holes, halfU } for one marker, centred on its spot on the band;
// null when the style has no shape of its own (the gap). `halfU` is how far
// it reaches along the band.
const profileCache = new Map();
export function markerProfile(kind, style, size = 1, width = 2.6) {
  const key = `${kind}|${style}|${size}|${width}`;
  if (!profileCache.has(key)) {
    if (profileCache.size > 200) profileCache.clear();
    profileCache.set(key, drawProfile(kind, style, size, width));
  }
  return profileCache.get(key);
}

// One polygon out of several overlapping ones, with any holes cut:
// { outer, holes } of the largest piece.
function fuse(solids, holes = [], keep = null) {
  let g = polygonClipping.union(...solids.map(r => [[r]]));
  if (holes.length) g = polygonClipping.difference(g, ...holes.map(r => [[r]]));
  if (keep) g = polygonClipping.intersection(g, [[keep]]);
  const area = ring => Math.abs(ring.reduce((a, q, i) => a + q[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * q[1], 0));
  const poly = g.reduce((best, x) => (area(x[0]) > area(best[0]) ? x : best));
  const open = ring => ring.slice(0, -1);
  return { outer: open(poly[0]), holes: poly.slice(1).map(open) };
}

// A ray: a thin spike from radius r0 out to r1 in direction `a`, w0 wide at
// its root and tapering to w1 at the tip.
function ray(a, r0, r1, w0, w1) {
  const c = Math.cos(a), sn = Math.sin(a);
  const at = (r, w) => [r * c - w * sn, r * sn + w * c];
  return [at(r0, -w0 / 2), at(r1, -w1 / 2), at(r1, w1 / 2), at(r0, w0 / 2)];
}

// The jewellery these follow is thin wire carrying shapes several times its
// width, often open: a ring of metal with nothing inside, where the band
// stops at the rim. `clear` on a profile is that empty circle ({ cx, r }, cx
// along the band): the band is left out inside it.
function drawProfile(kind, style, size, width) {
  const s = size;
  if (kind === 'sun') {
    if (style === 'rays') {
      // an open ring with fine rays, long and short by turns
      const rIn = 2.0 * s, rOut = 2.45 * s, n = 28, solids = [circle(0, 0, rOut, 72)];
      for (let i = 0; i < n; i++) solids.push(ray((i / n) * 2 * Math.PI - Math.PI / 2, rOut - 0.2 * s, (i % 2 ? 3.2 : 3.95) * s, 0.36 * s, 0.14 * s));
      return { ...fuse(solids, [circle(0, 0, rIn, 64)]), halfU: 3.95 * s, clear: { cx: 0, r: rIn } };
    }
    if (style === 'open') {
      // a small open ring with a dozen stubby rays
      const rIn = 1.75 * s, rOut = 2.3 * s, n = 12, solids = [circle(0, 0, rOut, 64)];
      for (let i = 0; i < n; i++) solids.push(ray((i / n) * 2 * Math.PI - Math.PI / 2, rOut - 0.2 * s, 3.15 * s, 0.5 * s, 0.22 * s));
      return { ...fuse(solids, [circle(0, 0, rIn, 56)]), halfU: 3.15 * s, clear: { cx: 0, r: rIn } };
    }
    if (style === 'burst') {
      // solid needles from a small core
      const n = 16, solids = [circle(0, 0, 0.85 * s, 32)];
      for (let i = 0; i < n; i++) solids.push(ray((i / n) * 2 * Math.PI - Math.PI / 2, 0.3 * s, (i % 2 ? 2.5 : 3.9) * s, 0.62 * s, 0.14 * s));
      return { ...fuse(solids), halfU: 3.9 * s };
    }
    if (style === 'rising') {
      // half a sun standing on the band, which is its horizon: a half disc, an
      // arc over it, and rays above. Each piece runs a little way below the
      // band's centre line (to different depths, so no two edges coincide)
      // and a low bar there ties them into one; the band hides all of that.
      const upper = (r, depth, n = 40) => { // the half of a circle above the line, closed a little below it
        const pts = [[-r, depth]];
        for (let i = 0; i <= n; i++) { const a = Math.PI + Math.PI * (i / n); pts.push([r * Math.cos(a), r * Math.sin(a)]); }
        pts.push([r, depth]);
        return pts;
      };
      const arch = upper(2.3 * s, 0.26 * s).concat(upper(1.85 * s, 0.26 * s).reverse());
      const n = 13, solids = [upper(1.25 * s, 0.2 * s), arch, [[-2.2 * s, -0.04 * s], [2.2 * s, -0.04 * s], [2.2 * s, 0.32 * s], [-2.2 * s, 0.32 * s]]];
      for (let i = 0; i < n; i++) solids.push(ray(-Math.PI * (0.07 + 0.86 * i / (n - 1)), 2.1 * s, (i % 2 ? 3.1 : 3.7) * s, 0.36 * s, 0.14 * s));
      return { ...fuse(solids), halfU: 3.7 * s };
    }
    if (style === 'radiant') { // kept for old saved settings
      const tip = 2.8 * s;
      return { outer: roundCorners(starburst([tip, 1.9 * s], 12), 0.2), holes: [circle(0, 0, 0.6 * s, 28)], halfU: tip };
    }
    if (style === 'star') {
      // long thin rays: the tips are left almost sharp
      const tip = 3.1 * s;
      return { outer: roundCorners(starburst([tip, 0.78 * s, 2.25 * s, 0.78 * s], 4), 0.1, 3), holes: [], halfU: tip };
    }
    const disc = blendedDisc(2.4 * s, width / 2, BLEND_R * s);
    return { outer: disc.outer, holes: [circle(0, 0, 1.15 * s, 48)], halfU: disc.halfU, clear: { cx: 0, r: 1.15 * s } };
  }

  if (kind === 'moon') {
    if (style === 'side') {
      // the classic crescent, horns along the band; the band runs into its back
      // on one side and into its mouth on the other
      const R = 2.7 * s, r = 2.25 * s, d = 1.05 * s, cap = 0.16 * s;
      const px = (d * d + (R - cap) ** 2 - (r + cap) ** 2) / (2 * d), py = Math.sqrt((R - cap) ** 2 - px * px);
      const a1 = Math.atan2(py, px), b1 = Math.atan2(py, px - d);
      const pts = [];
      const arc = (cx, cy, rad, from, to, n) => {
        for (let i = 0; i < n; i++) { const a = from + (to - from) * (i / n); pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); }
      };
      arc(0, 0, R, a1, 2 * Math.PI - a1, 56);
      arc(px, -py, cap, -a1, -b1 + Math.PI, 6);
      arc(d, 0, r, 2 * Math.PI - b1, b1, 40);
      arc(px, py, cap, b1 - Math.PI, a1, 6);
      return { outer: pts, holes: [], halfU: R };
    }
    if (style === 'eclipse') {
      // an open ring that swells into a crescent on one side
      const R = 2.6 * s, r = 1.95 * s, cx = 0.33 * s;
      return { outer: circle(0, 0, R, 72), holes: [circle(cx, 0, r, 64)], halfU: R, clear: { cx, r } };
    }
    if (style === 'hex') {
      const r = 2.35 * s;
      return { outer: roundCorners(starburst([r], 6), CORNER_R), holes: [], halfU: r * Math.cos(Math.PI / 6) };
    }
    if (style === 'crescent') {
      // A bowl with its horns up: the bite is big and set high, so the horns
      // stand clear above the band and the belly hangs below it (the band
      // itself covers the middle). Each horn ends in a small round cap
      // tangent to both circles.
      const R = 2.8 * s, r = 2.1 * s, d = 1.5 * s, cap = 0.3 * s, lift = 0.4 * s;
      const px = (d * d + (R - cap) ** 2 - (r + cap) ** 2) / (2 * d), py = Math.sqrt((R - cap) ** 2 - px * px);
      const a1 = Math.atan2(py, px), b1 = Math.atan2(py, px - d);
      const pts = [];
      // drawn with the bite toward +x, then turned to face up (-v) and raised
      const arc = (cx, cy, rad, from, to, n) => {
        for (let i = 0; i < n; i++) { const a = from + (to - from) * (i / n), x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a); pts.push([y, -x - lift]); }
      };
      arc(0, 0, R, a1, 2 * Math.PI - a1, 48);
      arc(px, -py, cap, -a1, -b1 + Math.PI, 8);
      arc(d, 0, r, 2 * Math.PI - b1, b1, 32);
      arc(px, py, cap, b1 - Math.PI, a1, 8);
      return { outer: pts, holes: [], halfU: R };
    }
    const disc = blendedDisc(2.15 * s, width / 2, BLEND_R * s);
    return { outer: disc.outer, holes: [], halfU: disc.halfU };
  }

  // ascendant
  if (style === 'gap') return null;
  if (style === 'triangle') {
    // An arrowhead along the band, wider than it, pointing against the zodiac:
    // with the ascendant on the left of the chart, that is straight up.
    const half = 2.3 * s;
    return { outer: roundCorners([[1.3 * s, -half], [-2.7 * s, 0], [1.3 * s, half]], CORNER_R), holes: [], halfU: 2.7 * s };
  }
  // bar: a stadium standing across the band
  const w = 0.75 * s, h = width / 2 + 1.5 * s;
  return { outer: roundCorners([[-w, -h], [w, -h], [w, h], [-w, h]], w * 0.98, 8), holes: [], halfU: w };
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

const BEND_STEP = 0.5;                    // mm, longest run along the band between mesh points
const GAP_MM = 2.2;                       // clear opening of the gap style, on the outer face
// Edge rounding as a share of the wall: a soft, almost oval section.
const bandFillet = design => Math.min(0.5, design.thickness * 0.37);
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
// thickness becomes radius (starting at `baseR`), x becomes angle (the
// ascendant at 180 degrees, zodiac order counter-clockwise on screen), y runs
// along the axis with y < 0 toward the viewer. Top and bottom edges are
// rounded by `filletR`, less where a shape is too fine for it.
function wrapPattern(polygons, { outerR, filletR, thickness, baseR = RING.innerR }) {
  const pos = [], nor = [];
  let tris = [], rounded = Infinity; // the edge radius actually used: less than asked if a shape is too fine
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
      thickness, filletR, minFilletR: 0.03, tolerance: 0.004, profileSteps: 7,
    });
    const base = pos.length / 3;
    for (let i = 0; i < m.vertices.length; i++) { pos.push(m.vertices[i]); nor.push(m.normals[i]); }
    for (let i = 0; i < m.triangles.length; i++) tris.push(m.triangles[i] + base);
    rounded = Math.min(rounded, m.filletR);
  }
  tris = splitForBend(pos, nor, tris, BEND_STEP * 1.05);

  const n = pos.length / 3;
  const vertices = new Float32Array(pos.length), normals = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) {
    const a = Math.PI - pos[3 * i] / outerR, rho = baseR + pos[3 * i + 2];
    const ca = Math.cos(a), sa = Math.sin(a);
    vertices[3 * i] = rho * ca; vertices[3 * i + 1] = rho * sa; vertices[3 * i + 2] = pos[3 * i + 1];
    const nx = nor[3 * i], ny = nor[3 * i + 1], nz = nor[3 * i + 2];
    normals[3 * i] = nx * sa + nz * ca; normals[3 * i + 1] = -nx * ca + nz * sa; normals[3 * i + 2] = ny;
  }
  // the wrap mirrors the pattern, so the triangles turn the other way
  const triangles = new Uint32Array(tris.length);
  for (let t = 0; t < tris.length; t += 3) { triangles[t] = tris[t]; triangles[t + 1] = tris[t + 2]; triangles[t + 2] = tris[t + 1]; }
  return { vertices, normals, triangles, filletR: rounded };
}

// Where the band is left out: at the ascendant for the gap style, and inside
// any open shape, so its middle is clear right through. Each opening is
// { c, lo, hi, ... }: its centre and where the metal stops either side (mm
// along the outer face), plus how the band ends there.
function bandOpenings(design, sunOffDeg, moonOffDeg) {
  const hw = design.width / 2, outerR = ringOuterR(design);
  const list = [];
  // fully round ends at the gap, where they show
  if (design.asc === 'gap') list.push({ c: 0, lo: -GAP_MM / 2, hi: GAP_MM / 2, round: hw * 0.98 });
  for (const [kind, off] of [['sun', sunOffDeg], ['moon', moonOffDeg]]) {
    const clear = markerProfile(kind, design[kind], design.size, design.width).clear;
    if (!clear) continue;
    const c = normDeg(off) * DEG * outerR + clear.cx;
    if (clear.r > hw + 0.12) {
      // the opening is wider than the band: the band ends in an arc tucked just under the rim
      const rho = clear.r + 0.06, reach = Math.sqrt(rho * rho - hw * hw);
      list.push({ c, lo: c - reach, hi: c + reach, arc: rho });
    } else {
      // a small hole: square ends, hidden under the shape around the hole
      list.push({ c, lo: c - clear.r - 0.15, hi: c + clear.r + 0.15, round: 0 });
    }
  }
  return list.sort((p, q) => p.c - q.c);
}

// How the band has to follow the sun and moon while they move: 'still' (it
// never changes), 'sun' or 'moon' (it has one opening, under that body: build
// it once and turn it with the body), or 'rebuild' (two or more openings that
// move against each other: rebuild as they go).
export function bandMotion(design) {
  const open = bandOpenings(design, 90, 180);
  const moving = ['sun', 'moon'].filter(kind => markerProfile(kind, design[kind], design.size, design.width).clear);
  if (!moving.length) return 'still';
  return open.length === 1 ? moving[0] : 'rebuild';
}

// The band, open wherever bandOpenings() says, for the sun and moon at these
// offsets past the ascendant.
export function buildBandMesh(design, sunOffDeg = 180, moonOffDeg = 180) {
  return wrapPattern(bandStrips(design, sunOffDeg, moonOffDeg), {
    outerR: ringOuterR(design), filletR: bandFillet(design), thickness: design.thickness,
  });
}

// The band laid flat, as polygons: one strip, or the pieces between openings.
function bandStrips(design, sunOffDeg, moonOffDeg) {
  const hw = design.width / 2, LENGTH = 2 * Math.PI * ringOuterR(design);
  const openings = bandOpenings(design, sunOffDeg, moonOffDeg);
  if (!openings.length) {
    // the ends overlap, so the join is buried
    return [{ outer: [[-1.2, -hw], [LENGTH + 1.2, -hw], [LENGTH + 1.2, hw], [-1.2, hw]], holes: [] }];
  }

  // metal runs from the end of each opening to the start of the next
  const strips = [];
  for (let i = 0; i < openings.length; i++) {
    const A = openings[i], B = openings[(i + 1) % openings.length];
    const wrap = i === openings.length - 1 ? LENGTH : 0;
    const x0 = A.hi, x1 = B.lo + wrap;
    if (x1 - x0 < design.width * 1.1) continue; // too short to be more than a bead: leave it out
    const pts = [], radii = [];
    const end = (o, side, shift) => { // side +1: the strip lies to the right of this opening
      if (o.arc) {
        const th = Math.asin(hw / o.arc), n = 10;
        for (let k = 0; k <= n; k++) {
          const phi = side * (th - 2 * th * k / n);
          pts.push([o.c + shift + side * o.arc * Math.cos(phi), o.arc * Math.sin(phi)]);
          radii.push(0);
        }
      } else {
        const x = (side > 0 ? o.hi : o.lo) + shift;
        pts.push([x, side * hw], [x, -side * hw]);
        radii.push(o.round, o.round);
      }
    };
    end(A, 1, 0);       // from the lower edge up to the upper
    end(B, -1, wrap);   // and back down
    strips.push({ outer: roundCorners(pts, radii, 8), holes: [] });
  }
  return strips;
}

// Keep-clear distances for layoutOffsets(), from the shapes in this design:
// enough that neighbours touch at most by their rays.
export function layoutGaps(design) {
  const reach = kind => { const p = markerProfile(kind, design[kind], design.size, design.width); return p ? p.halfU : GAP_MM / 2; };
  const deg = mm => (mm / ringOuterR(design)) / DEG;
  const sun = reach('sun'), moon = reach('moon'), asc = reach('asc');
  return { bodyGap: deg((sun + moon) * 0.92), ascGap: deg((asc + Math.max(sun, moon)) * 0.92) };
}

// One marker as its own mesh, lying on the band at 180 degrees past the
// ascendant (the right-hand side): turn it about the axis to place it. Its
// inside is flush with the band's, its edges are rounded like the band's, and
// its face stands `relief` mm out from the band's (0 for flush). null for the
// gap, which is only an opening.
//
// Flush, a marker's faces are exactly the band's where the two overlap, so
// its edges vanish into the band with no seam. Whoever draws the two should
// let the band win the depth test there (a polygon offset on the marker).
export function buildMarkerMesh(kind, design) {
  const p = markerProfile(kind, design[kind], design.size, design.width);
  if (!p) return null;
  const outerR = ringOuterR(design), half = Math.PI * outerR;
  const shifted = ring => ring.map(q => [q[0] + half, q[1]]);
  const relief = Math.max(0, design.relief || 0);
  return wrapPattern([{ outer: shifted(p.outer), holes: p.holes.map(shifted) }], {
    outerR, filletR: bandFillet(design), thickness: design.thickness + relief,
  });
}

// Shapes whose outline can take the band's own edge rounding, so they can be
// merged into it without making the band any less round.
const MERGEABLE = { asc: ['bar', 'triangle'], sun: ['halo'], moon: ['full', 'hex'] };

// The ring at rest as one piece of metal: the band with its smooth shapes
// merged into it (holes cut through), so there is no overlap and nothing to
// mismatch, inside or out. Returns { mesh, merged } where `merged` lists the
// kinds ('asc' | 'sun' | 'moon') that are part of it; the others still need
// their own mesh on top. A shape is left out if merging it would cost the
// band its rounding (two shapes meeting at a sliver, say). null if none fit.
export function buildWholeMesh(design, sunOffDeg, moonOffDeg) {
  const outerR = ringOuterR(design), LENGTH = 2 * Math.PI * outerR;
  const offsets = { asc: 0, sun: sunOffDeg, moon: moonOffDeg };
  const candidates = ['sun', 'moon', 'asc'].filter(kind => MERGEABLE[kind].includes(design[kind]));
  const want = bandFillet(design), full = Math.min(want, design.thickness / 2 - 0.1);
  const open = ring => ring.slice(0, -1); // polygon-clipping repeats the first point

  const attempt = kinds => {
    // the band stays open inside an open shape either way, merged or not
    const strips = bandStrips(design, sunOffDeg, moonOffDeg);
    const solids = strips.map(st => [st.outer]), holes = [];
    for (const kind of kinds) {
      const p = markerProfile(kind, design[kind], design.size, design.width);
      const x0 = normDeg(offsets[kind]) * DEG * outerR;
      // a shape that crosses the seam at the ascendant is drawn at both ends
      const shifts = [0];
      if (x0 - p.halfU < 1.2) shifts.push(LENGTH);
      if (x0 + p.halfU > LENGTH - 1.2) shifts.push(-LENGTH);
      for (const dx of shifts) {
        solids.push([p.outer.map(q => [q[0] + x0 + dx, q[1]])]);
        for (const h of p.holes) holes.push([h.map(q => [q[0] + x0 + dx, q[1]])]);
      }
    }
    let metal = polygonClipping.union(...solids);
    if (holes.length) metal = polygonClipping.difference(metal, ...holes);
    const mesh = wrapPattern(metal.map(poly => ({ outer: open(poly[0]), holes: poly.slice(1).map(open) })), {
      outerR, filletR: want, thickness: design.thickness,
    });
    return mesh.filletR < full - 1e-6 ? null : mesh;
  };

  // all of them if possible, else the most that will go
  const n = candidates.length;
  const subsets = [];
  for (let mask = (1 << n) - 1; mask > 0; mask--) subsets.push(candidates.filter((_, i) => mask & (1 << i)));
  subsets.sort((a, b) => b.length - a.length);
  for (const kinds of subsets) {
    const mesh = attempt(kinds);
    if (mesh) return { mesh, merged: kinds };
  }
  return null;
}
