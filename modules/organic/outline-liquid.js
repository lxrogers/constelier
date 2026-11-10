// outline-liquid.js
// Option B — "Liquid": treat the metal as a distance field. Each chord is a
// tapered capsule, the rim is a ring, and they are merged with a smooth
// minimum, so where bars meet each other or the rim the metal pools into
// a neck whose shape comes from the field rather than from a fillet radius.
// The void boundaries are the field's zero contour, fitted with Beziers.
//
// Because smooth-min only ever adds metal, the thinnest wire can never drop
// below 2 × midHalfWidth, and narrow voids close up on their own.

import { contours } from 'd3-contour';
import { chordSegments, signedArea, ensureCCW, resampleLoop, taubinSmooth, fitC2Loop, toOutlineData, limitTipRadius } from './outline-common.js';
import { taperedHalfWidth } from './outline-voids.js';

export const LIQUID_DEFAULTS = {
  midHalfWidth: 3,
  endHalfWidth: 5.2,
  taperPower: 2,
  blend: 11,             // smooth-min radius: how far metal pools at junctions
  barOvershoot: 15,      // bars run this far past the rim (no end caps inside)
  resolution: 0.25,      // field grid spacing (model units)
  minArea: 185,
  minVoidRadius: 2.0,    // drop voids whose largest inscribed circle is smaller
  minTipRadius: 1.2,
};

export function liquidField(chords, circleRadius, o) {
  const segs = chordSegments(chords, circleRadius).map(([p, q]) => {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const e = o.barOvershoot ?? 0;
    return { p, dx, dy, len, len2: len * len, t0: -e / len, t1: 1 + e / len };
  });
  const h = o.resolution;
  const ext = circleRadius + 2;
  const nx = Math.ceil((2 * ext) / h) + 1;
  const ny = nx;
  const field = new Float64Array(nx * ny);
  const wOpts = { midHalfWidth: o.midHalfWidth, endHalfWidth: o.endHalfWidth, taperPower: o.taperPower };
  const k = o.blend;
  const ds = new Float64Array(segs.length);
  for (let j = 0; j < ny; j++) {
    const y = -ext + j * h;
    for (let i = 0; i < nx; i++) {
      const x = -ext + i * h;
      const rim = circleRadius - Math.hypot(x, y);
      for (let si = 0; si < segs.length; si++) {
        const s = segs[si];
        const t = ((x - s.p[0]) * s.dx + (y - s.p[1]) * s.dy) / s.len2;
        // Bars run on past the rim, so a bar that meets the rim at a glancing
        // angle has a straight flank there instead of a round end cap
        // bulging inside the circle (that cap made a kink at the junction).
        const tc = t < s.t0 ? s.t0 : t > s.t1 ? s.t1 : t;
        const px = s.p[0] + s.dx * tc - x, py = s.p[1] + s.dy * tc - y;
        ds[si] = Math.hypot(px, py) - taperedHalfWidth(t, s.len, circleRadius, wOpts);
      }
      // Order matters with a pairwise smooth min; rim first, then bars.
      let m = rim;
      for (let si = 0; si < segs.length; si++) {
        const d = ds[si];
        if (d - m > k) continue; // too far to blend: no influence
        m = smin3(m, d, k);
      }
      field[j * nx + i] = m;
    }
  }
  return { field, nx, ny, h, ext };
}

// C2 cubic smooth min (Quilez): no curvature jump where the blend starts.
function smin3(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k / 6;
}

export function buildLiquidOutline(chords, circleRadius, borderThickness, options = {}) {
  const o = { ...LIQUID_DEFAULTS, ...options };
  const { field, nx, ny, h, ext } = liquidField(chords, circleRadius, o);
  // d3-contour: polygons enclosing values >= threshold, i.e. the voids.
  const mp = contours().size([nx, ny]).smooth(true).thresholds([0])(field)[0];
  const loops = [];
  for (const poly of mp.coordinates) {
    const ring = poly[0].slice(0, -1).map(([gx, gy]) => [-ext + (gx - 0.5) * h, -ext + (gy - 0.5) * h]);
    if (ring.length < 8) continue;
    const ccw = ensureCCW(ring);
    if (Math.abs(signedArea(ccw)) < o.minArea) continue;
    // Largest inscribed radius ≈ max field value inside the void.
    let maxF = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of ccw) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const i0 = Math.floor((minX + ext) / h), i1 = Math.ceil((maxX + ext) / h);
    const j0 = Math.floor((minY + ext) / h), j1 = Math.ceil((maxY + ext) / h);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = field[j * nx + i];
      if (v > maxF && pointInRing(-ext + i * h, -ext + j * h, ccw)) maxF = v;
    }
    if (maxF < o.minVoidRadius) continue;
    const smooth = taubinSmooth(resampleLoop(ccw, 0.4), 3);
    // The limiter lands a little under its target, so aim 25% high.
    loops.push(fitC2Loop(limitTipRadius(smooth, o.minTipRadius * 1.25, 0.3)));
  }
  return toOutlineData(loops, circleRadius, borderThickness);
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
