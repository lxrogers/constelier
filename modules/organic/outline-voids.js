// outline-voids.js
// Vector void extraction shared by the "tapered" and "pebble" algorithms:
// disc minus the union of (optionally tapered) chord bars, via polygon-clipping.

import polygonClipping from 'polygon-clipping';
import { circlePolygon, chordSegments, signedArea, ensureCCW, minInteriorAngle } from './outline-common.js';

// Half-width along a chord. t in [0,1] between the two rim points.
// Short chords taper less so tiny bars near the rim don't balloon.
export function taperedHalfWidth(t, len, circleRadius, { midHalfWidth, endHalfWidth, taperPower = 2 }) {
  const tc = Math.min(1, Math.max(0, t));
  const lenFactor = Math.min(1, len / circleRadius);
  const extra = (endHalfWidth - midHalfWidth) * lenFactor;
  return midHalfWidth + extra * Math.pow(Math.abs(2 * tc - 1), taperPower);
}

// Build one bar polygon whose half-width follows widthFn(t).
function barPolygon(p, q, widthFn, extend, samples) {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const t0 = -extend / len, t1 = 1 + extend / len;
  const left = [], right = [];
  for (let i = 0; i <= samples; i++) {
    const t = t0 + (t1 - t0) * i / samples;
    const w = widthFn(t, len);
    const cx = p[0] + dx * t, cy = p[1] + dy * t;
    left.push([cx + nx * w, cy + ny * w]);
    right.push([cx - nx * w, cy - ny * w]);
  }
  const ring = left.concat(right.reverse());
  ring.push(ring[0]);
  return [ring];
}

// Returns CCW void polygons (open rings, no repeated end point) after the
// same small-region filter the current algorithm uses.
export function computeVoids(chords, circleRadius, widthFn, { minArea = 185, minAngle = 5, rimSegments = 720, barSamples = 48 } = {}) {
  const segs = chordSegments(chords, circleRadius);
  const disc = circlePolygon(circleRadius, rimSegments);
  const discGeom = [[...disc, disc[0]]];
  const bars = segs.map(([p, q]) => barPolygon(p, q, widthFn, 12, barSamples));
  let voids = bars.length ? polygonClipping.difference(discGeom, ...bars) : [discGeom];
  const out = [];
  for (const poly of voids) {
    const ring = poly[0].slice(0, -1);
    if (ring.length < 3) continue;
    const ccw = ensureCCW(ring);
    const area = Math.abs(signedArea(ccw));
    if (area < minArea) continue;
    if (minAngle > 0 && minInteriorAngle(dedupe(ccw)) < minAngle) continue;
    out.push(dedupe(ccw));
  }
  return out;
}

function dedupe(ring) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) out.pop();
  }
  return out;
}

// Indices of "real" corners on a sampled ring (turning angle above threshold).
export function findCorners(ring, thresholdDeg = 12) {
  const n = ring.length, idx = [];
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n], b = ring[i], c = ring[(i + 1) % n];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const turn = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI;
    if (turn > thresholdDeg) idx.push({ i, turn });
  }
  return idx;
}

// Merge corners that sit within mergeDist (arc length) of each other —
// e.g. several chords leaving the same planet point on the rim produce a
// cluster of small corners that should read as one.
// Returns [{ i0, i1, turn }] with i0..i1 the first/last ring index.
export function clusterCorners(ring, corners, mergeDist = 4) {
  if (corners.length === 0) return [];
  const n = ring.length;
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const p = ring[i - 1], q = ring[i % n];
    cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const L = cum[n];
  const groups = [];
  for (const c of corners) {
    const g = groups[groups.length - 1];
    if (g && cum[c.i] - cum[g.i1] < mergeDist) { g.i1 = c.i; g.turn += c.turn; }
    else groups.push({ i0: c.i, i1: c.i, turn: c.turn });
  }
  // Wrap-around merge of last group into first.
  if (groups.length > 1) {
    const first = groups[0], last = groups[groups.length - 1];
    if (cum[first.i0] + L - cum[last.i1] < mergeDist) {
      first.i0 = last.i0; first.turn += last.turn; groups.pop();
    }
  }
  return groups;
}
