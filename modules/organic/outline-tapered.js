// outline-tapered.js
// Option A — "Tapered": each chord becomes a bar that is thinnest at its
// middle and flares toward the rim; every corner of every void is then
// replaced by a curvature-continuous (G2) blend instead of a circular arc.
//
// The blend is a cubic Bezier whose two inner control points both sit on
// the corner vertex. Against straight-ish sides that gives zero curvature
// where the blend starts and ends, rising smoothly to a peak in the middle,
// so corners read as "poured" rather than "drilled".

import { computeVoids, findCorners, clusterCorners, taperedHalfWidth } from './outline-voids.js';
import { bez, fitBezierLoop, toOutlineData, limitTipRadius } from './outline-common.js';

export const TAPERED_DEFAULTS = {
  midHalfWidth: 3,      // = today's lineThickness, so the thinnest wire is unchanged
  endHalfWidth: 6.8,    // flare at the rim
  taperPower: 1.6,      // 2 = parabolic; higher keeps the middle thin longer
  blendSize: 9,         // trim distance along each side of a corner
  blendFullness: 1,     // 1 = G2 (both handles on the vertex); <1 softer, rounder
  minArea: 185,
  minAngle: 5,
  fitTolerance: 0.035,
  minTipRadius: 1.2,    // no void tip tighter than this
};

function cumulative(ring) {
  const n = ring.length, s = [0];
  for (let i = 1; i <= n; i++) {
    const p = ring[i - 1], q = ring[i % n];
    s.push(s[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  return s; // s[n] = perimeter
}

// Point and unit tangent at arc-length position u (wraps).
function pointAt(ring, cum, u) {
  const n = ring.length, L = cum[n];
  u = ((u % L) + L) % L;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid; }
  const p = ring[lo], q = ring[(lo + 1) % n];
  const segL = cum[lo + 1] - cum[lo] || 1e-12;
  const t = (u - cum[lo]) / segL;
  const tx = (q[0] - p[0]) / segL, ty = (q[1] - p[1]) / segL;
  return { p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], tan: [tx, ty], seg: lo };
}

function lineIntersect(a, ta, b, tb) {
  const det = ta[0] * tb[1] - ta[1] * tb[0];
  if (Math.abs(det) < 1e-9) return null;
  const s = ((b[0] - a[0]) * tb[1] - (b[1] - a[1]) * tb[0]) / det;
  return [a[0] + ta[0] * s, a[1] + ta[1] * s];
}

export function blendCorners(ring, opts) {
  const corners = clusterCorners(ring, findCorners(ring, 12), 4);
  if (corners.length === 0) return ring;
  const cum = cumulative(ring);
  const L = cum[ring.length];
  // A cluster that wraps past index 0 starts at a negative arc position.
  const pos0 = corners.map(c => cum[c.i0] - (c.i1 < c.i0 ? L : 0));
  const pos1 = corners.map(c => cum[c.i1]);
  const k = corners.length;
  const blends = [];
  for (let j = 0; j < k; j++) {
    const prevGap = j === 0 ? pos0[0] + L - pos1[k - 1] : pos0[j] - pos1[j - 1];
    const nextGap = j === k - 1 ? pos0[0] + L - pos1[j] : pos0[j + 1] - pos1[j];
    const turn = Math.min(175, corners[j].turn);
    // Acute corners (big turn) get a longer run-out so the blend isn't pinched.
    const scale = 1 + 0.9 * Math.max(0, (turn - 90) / 90);
    const want = opts.blendSize * scale;
    const dPrev = Math.min(want, 0.46 * (k === 1 ? L : prevGap));
    const dNext = Math.min(want, 0.46 * (k === 1 ? L : nextGap));
    const A = pointAt(ring, cum, pos0[j] - dPrev);
    const B = pointAt(ring, cum, pos1[j] + dNext);
    let V = lineIntersect(A.p, A.tan, B.p, B.tan);
    // Fall back to the corner itself if the tangents don't meet in front.
    const mid = ring[corners[j].i0];
    if (!V || Math.hypot(V[0] - mid[0], V[1] - mid[1]) > 3 * Math.max(dPrev, dNext)) V = mid;
    // Needle-like tips (acute corners) get blunter handles so the void ends
    // in a rounded nose rather than a sliver.
    const f = opts.blendFullness * (1 - 0.45 * Math.min(1, Math.max(0, (turn - 100) / 60)));
    const c1 = [A.p[0] + f * (V[0] - A.p[0]), A.p[1] + f * (V[1] - A.p[1])];
    const c2 = [B.p[0] + f * (V[0] - B.p[0]), B.p[1] + f * (V[1] - B.p[1])];
    blends.push({ startU: pos0[j] - dPrev, endU: pos1[j] + dNext, curve: [A.p, c1, c2, B.p] });
  }
  // Stitch: original ring between blends, sampled blend curves at corners.
  const out = [];
  for (let j = 0; j < k; j++) {
    const b = blends[j];
    for (let i = 0; i < 24; i++) out.push(bez(b.curve, i / 24));
    const nb = blends[(j + 1) % k];
    let u0 = b.endU, u1 = nb.startU;
    if (u1 <= u0) u1 += L;
    // Walk original vertices between u0 and u1.
    out.push(pointAt(ring, cum, u0).p);
    const n = ring.length;
    for (let i = 0; i < n * 2; i++) {
      const u = cum[i % n] + (i >= n ? L : 0);
      if (u > u0 + 1e-6 && u < u1 - 1e-6) out.push(ring[i % n]);
    }
  }
  return out;
}

export function buildTaperedOutline(chords, circleRadius, borderThickness, options = {}) {
  const o = { ...TAPERED_DEFAULTS, ...options };
  const widthFn = (t, len) => taperedHalfWidth(t, len, circleRadius, o);
  const voids = computeVoids(chords, circleRadius, widthFn, { minArea: o.minArea, minAngle: o.minAngle });
  const loops = voids.map(ring => {
    const blended = blendCorners(ring, o);
    return fitBezierLoop(limitTipRadius(blended, o.minTipRadius, 0.35), o.fitTolerance);
  });
  return toOutlineData(loops, circleRadius, borderThickness);
}
