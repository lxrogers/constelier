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
import { chordSegments, signedArea, ensureCCW, resampleLoop, taubinSmooth, fitBezierLoop, toOutlineData, limitTipRadius } from './outline-common.js';
import { taperedHalfWidth } from './outline-voids.js';

export const LIQUID_DEFAULTS = {
  midHalfWidth: 3,
  endHalfWidth: 5.2,
  taperPower: 2,
  blend: 8,              // smooth-min radius: how far metal pools at junctions
  resolution: 0.25,      // field grid spacing (model units)
  minArea: 185,
  minVoidRadius: 2.0,    // drop voids whose largest inscribed circle is smaller
  fitTolerance: 0.05,
  minTipRadius: 1.2,
};

// Polynomial smooth min (Quilez). Only acts where |a-b| < k.
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function liquidField(chords, circleRadius, o) {
  const segs = chordSegments(chords, circleRadius).map(([p, q]) => {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    return { p, dx, dy, len, len2: len * len };
  });
  const h = o.resolution;
  const ext = circleRadius + 2;
  const nx = Math.ceil((2 * ext) / h) + 1;
  const ny = nx;
  const field = new Float64Array(nx * ny);
  const wOpts = { midHalfWidth: o.midHalfWidth, endHalfWidth: o.endHalfWidth, taperPower: o.taperPower };
  for (let j = 0; j < ny; j++) {
    const y = -ext + j * h;
    for (let i = 0; i < nx; i++) {
      const x = -ext + i * h;
      let m = circleRadius - Math.hypot(x, y); // rim: negative outside the circle
      for (const s of segs) {
        let t = ((x - s.p[0]) * s.dx + (y - s.p[1]) * s.dy) / s.len2;
        const tc = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = s.p[0] + s.dx * tc - x, py = s.p[1] + s.dy * tc - y;
        const d = Math.hypot(px, py) - taperedHalfWidth(t, s.len, circleRadius, wOpts);
        if (d - m > o.blend) continue; // far away: no influence
        m = smin(m, d, o.blend);
      }
      field[j * nx + i] = m;
    }
  }
  return { field, nx, ny, h, ext };
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
    loops.push(fitBezierLoop(limitTipRadius(smooth, o.minTipRadius, 0.4), o.fitTolerance));
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
