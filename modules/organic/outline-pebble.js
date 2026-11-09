// outline-pebble.js
// Option C — "Pebble": work on the voids instead of the bars. Each void of
// the current layout is redrawn as one closed, curvature-continuous (C2)
// B-spline: its corners become soft, and each straight side bows outward
// into the bar beside it. A bar therefore swells at every crossing and
// necks down between crossings, like a string of beads or a bone.
//
// The bow is reduced void by void until the thinnest wire is back at the
// floor (2 × midHalfWidth, today's bar width).

import { computeVoids, findCorners, clusterCorners } from './outline-voids.js';
import { toOutlineData, sampleBezierLoop, minCurvatureRadius, limitTipRadius, resampleLoop, fitBezierLoop, loopLength } from './outline-common.js';

export const PEBBLE_DEFAULTS = {
  baseHalfWidth: 4.8,   // bars start a bit wider than today …
  midHalfWidth: 3,      // … and neck down to today's width at most
  cornerSoftness: 0.24, // 0.1 crisp → 0.35 very round
  bulgeRatio: 0.12,     // outward bow as a fraction of side length
  maxBulge: 3.2,
  minBulgeSide: 10,     // short sides stay straight (avoids wobbles)
  maxCornerRun: 11,     // cap on how far a corner's softening reaches
  rimStep: 15,
  minTipRadius: 1.2,
  bluntTipTurn: 115,    // corners turning more than this get a blunt nose
  minArea: 185,
  minAngle: 5,
};

function sideSample(pts, u) {
  // point + tangent at arc-length u along an open polyline
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (acc + l >= u || i === pts.length - 2) {
      const t = l > 1e-12 ? Math.min(1, Math.max(0, (u - acc) / l)) : 0;
      return { p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], tan: l > 1e-12 ? [(q[0] - p[0]) / l, (q[1] - p[1]) / l] : [1, 0] };
    }
    acc += l;
  }
  return { p: pts[pts.length - 1], tan: [1, 0] };
}

function polyLen(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return L;
}

// Build control points for one CCW void ring.
function controlPolygon(ring, circleRadius, o, bulgeScale) {
  const groups = clusterCorners(ring, findCorners(ring, 4), 4);
  if (groups.length < 2) return ring.filter((_, i) => i % 6 === 0);
  const n = ring.length, ctrl = [];
  for (let k = 0; k < groups.length; k++) {
    const g = groups[k], a = g.i1, b = groups[(k + 1) % groups.length].i0;
    // Acute corners (needle tips) drop their corner point entirely, so the
    // spline swings round in a blunt nose. Others keep it; a merged cluster
    // contributes its first and last corner points.
    const sharp = g.turn > o.bluntTipTurn;
    if (!sharp && g.i0 !== g.i1) ctrl.push(ring[g.i0]);
    const side = [];
    for (let i = a; ; i = (i + 1) % n) { side.push(ring[i]); if (i === b) break; }
    const L = polyLen(side);
    const mid = side[Math.floor(side.length / 2)];
    const onRim = side.length > 2 && Math.abs(Math.hypot(mid[0], mid[1]) - circleRadius) < 0.05;
    if (!sharp) ctrl.push(side[0]);
    const s = Math.min(o.cornerSoftness * L, o.maxCornerRun);
    if (onRim) {
      const steps = Math.max(1, Math.round((L - 2 * s) / o.rimStep));
      for (let j = 0; j <= steps; j++) ctrl.push(sideSample(side, s + (L - 2 * s) * j / steps).p);
    } else {
      const bulge = L < o.minBulgeSide ? 0 : Math.min(o.bulgeRatio * L, o.maxBulge) * bulgeScale;
      // The whole side bows on a parabola (zero at the corners), which keeps
      // the control polygon convex, so the curve has no wobbles.
      // CCW ring → outward normal is to the right of travel.
      const fs = [s / L, 0.3, 0.5, 0.7, 1 - s / L].filter((f, i, a) => i === 0 || f > a[i - 1] + 0.05);
      for (const f of fs) {
        const m = sideSample(side, L * f);
        const b = 4 * bulge * f * (1 - f);
        ctrl.push([m.p[0] + m.tan[1] * b, m.p[1] - m.tan[0] * b]);
      }
    }
  }
  return ctrl;
}

// Periodic uniform cubic B-spline → exact cubic Beziers (C2 joins).
function bsplineToBeziers(P) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    out.push([
      [(p0[0] + 4 * p1[0] + p2[0]) / 6, (p0[1] + 4 * p1[1] + p2[1]) / 6],
      [(2 * p1[0] + p2[0]) / 3, (2 * p1[1] + p2[1]) / 3],
      [(p1[0] + 2 * p2[0]) / 3, (p1[1] + 2 * p2[1]) / 3],
      [(p1[0] + 4 * p2[0] + p3[0]) / 6, (p1[1] + 4 * p2[1] + p3[1]) / 6],
    ]);
  }
  return out;
}

export function buildPebbleOutline(chords, circleRadius, borderThickness, options = {}) {
  const o = { ...PEBBLE_DEFAULTS, ...options };
  const widthFn = () => o.baseHalfWidth;
  const voids = computeVoids(chords, circleRadius, widthFn, { minArea: o.minArea, minAngle: o.minAngle });
  const scales = voids.map(() => 1);
  const floor = 2 * o.midHalfWidth;
  let loops = [];
  for (let iter = 0; iter < 10; iter++) {
    loops = voids.map((ring, i) => bsplineToBeziers(controlPolygon(ring, circleRadius, o, scales[i])));
    const polys = loops.map(l => sampleBezierLoop(l, 10));
    // Per-void clearance to everything else.
    let ok = true;
    for (let i = 0; i < polys.length; i++) {
      const others = polys.filter((_, j) => j !== i);
      const mine = clearance(polys[i], others, circleRadius + borderThickness);
      if (mine < floor - 0.05 && scales[i] > 0.01) { scales[i] *= 0.7; ok = false; }
    }
    if (ok) break;
  }
  // Only voids with a too-tight tip leave the exact B-spline form.
  // Those are re-sampled, tip-rounded and turned back into a B-spline, so
  // every void stays curvature-continuous.
  loops = loops.map(l => {
    if (minCurvatureRadius(l) >= 0.75 * o.minTipRadius) return l;
    const rounded = limitTipRadius(sampleBezierLoop(l, 24), o.minTipRadius * 1.3, 0.3);
    const fitted = fitBezierLoop(rounded, 0.04);
    return minCurvatureRadius(fitted) >= 0.5 * o.minTipRadius ? fitted : bsplineToBeziers(resampleLoop(rounded, Math.max(2.2, loopLength(rounded) / 80)));
  });
  return toOutlineData(loops, circleRadius, borderThickness);
}

function clearance(poly, others, outerRadius) {
  let best = Infinity;
  for (const p of poly) {
    best = Math.min(best, outerRadius - Math.hypot(p[0], p[1]));
    for (const q of others) for (const s of q) {
      const dx = s[0] - p[0], dy = s[1] - p[1];
      if (Math.abs(dx) > best || Math.abs(dy) > best) continue;
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}
