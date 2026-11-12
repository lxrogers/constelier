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
  const segs = chordSegments(chords, circleRadius).map(([p, q, w]) => {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const e = o.barOvershoot ?? 0;
    // taperedHalfWidth() inlined below: mid + extra * |2t - 1|^power
    const extra = (o.endHalfWidth - o.midHalfWidth) * Math.min(1, len / circleRadius);
    // w < 1 (grow-in animations) thins the bar and how far it pools.
    return { px0: p[0], py0: p[1], dx, dy, len, len2: len * len, t0: -e / len, t1: 1 + e / len, extra: extra * w, mid: o.midHalfWidth * w, k: o.blend * w };
  });
  const h = o.resolution;
  const ext = circleRadius + 2;
  const nx = Math.ceil((2 * ext) / h) + 1;
  const ny = nx;
  const field = new Float64Array(nx * ny);
  const ns = segs.length;
  const ds = new Float64Array(ns);
  const pw = o.taperPower ?? 2;

  function evalAt(x, y) {
    const rim = circleRadius - Math.hypot(x, y);
    for (let si = 0; si < ns; si++) {
      const s = segs[si];
      const t = ((x - s.px0) * s.dx + (y - s.py0) * s.dy) / s.len2;
      // Bars run on past the rim, so a bar that meets the rim at a glancing
      // angle has a straight flank there instead of a round end cap
      // bulging inside the circle (that cap made a kink at the junction).
      const tc = t < s.t0 ? s.t0 : t > s.t1 ? s.t1 : t;
      const px = s.px0 + s.dx * tc - x, py = s.py0 + s.dy * tc - y;
      const tw = t < 0 ? 0 : t > 1 ? 1 : t;
      const u = Math.abs(2 * tw - 1);
      const hw = s.mid + s.extra * (pw === 2 ? u * u : Math.pow(u, pw));
      ds[si] = Math.hypot(px, py) - hw;
    }
    // Order matters with a pairwise smooth min; rim first, then bars.
    let m = rim;
    for (let si = 0; si < ns; si++) {
      const d = ds[si], ks = segs[si].k;
      if (d - m > ks) continue; // too far to blend: no influence
      m = smin3(m, d, ks);
    }
    return m;
  }

  if (o.exactField) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) field[j * nx + i] = evalAt(-ext + i * h, -ext + j * h);
    return { field, nx, ny, h, ext, evalAt, approxError: 0 };
  }

  // Adaptive fill. The field is a distance (each capsule, the rim and the
  // smooth min of them change by at most ~1 unit per unit moved; the
  // cubic smooth min is a convex blend of its inputs' gradients), so a
  // block whose corners are all well away from zero can't cross zero
  // inside. Those blocks are filled by bilinear interpolation; blocks near
  // the outline are split and evaluated exactly, down to single cells. The
  // zero contour (the void outlines) comes out identical to evaluating
  // every cell; only values deep inside metal or voids are approximate.
  // About 5-8x fewer evaluations on a busy chart.
  const LIP = 1.5; // safety factor over the field's slope
  let S = 16;
  while (S > 1 && S >= nx / 4) S >>= 1;
  const gx = Math.ceil((nx - 1) / S) * S + 1; // padded lattice so blocks tile
  const gy = gx;
  const pad = new Float64Array(gx * gy);
  const known = new Uint8Array(gx * gy);
  const val = (i, j) => {
    const idx = j * gx + i;
    if (!known[idx]) { pad[idx] = evalAt(-ext + i * h, -ext + j * h); known[idx] = 1; }
    return pad[idx];
  };
  const stack = [];
  for (let j = 0; j < gy - 1; j += S) for (let i = 0; i < gx - 1; i += S) stack.push(i, j, S);
  while (stack.length) {
    const s = stack.pop(), j = stack.pop(), i = stack.pop();
    const f00 = val(i, j), f10 = val(i + s, j), f01 = val(i, j + s), f11 = val(i + s, j + s);
    if (s === 1) continue;
    const lo = Math.min(f00, f10, f01, f11), hi = Math.max(f00, f10, f01, f11);
    const margin = LIP * s * h * Math.SQRT1_2;
    if (lo > margin || hi < -margin) {
      // Same sign everywhere in the block: interpolate the interior.
      for (let b = 0; b <= s; b++) {
        const v = b / s, row = (j + b) * gx;
        for (let a = 0; a <= s; a++) {
          const idx = row + i + a;
          if (known[idx]) continue;
          const u = a / s;
          pad[idx] = (f00 * (1 - u) + f10 * u) * (1 - v) + (f01 * (1 - u) + f11 * u) * v;
          known[idx] = 2; // interpolated; a refining neighbour may overwrite edge nodes
        }
      }
      continue;
    }
    const hs = s >> 1;
    // The children's new corners must be exact, even where an interpolated
    // neighbour already filled the shared edge.
    for (const [a, b] of [[hs, 0], [0, hs], [hs, hs], [s, hs], [hs, s]]) {
      const idx = (j + b) * gx + i + a;
      if (known[idx] !== 1) { pad[idx] = evalAt(-ext + (i + a) * h, -ext + (j + b) * h); known[idx] = 1; }
    }
    stack.push(i, j, hs, i + hs, j, hs, i, j + hs, hs, i + hs, j + hs, hs);
  }
  for (let j = 0; j < ny; j++) field.set(pad.subarray(j * gx, j * gx + nx), j * nx);
  // Interpolated values can sit below the true value by up to this much.
  return { field, nx, ny, h, ext, evalAt, approxError: LIP * S * h * Math.SQRT1_2 };
}

// C2 cubic smooth min (Quilez): no curvature jump where the blend starts.
function smin3(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k / 6;
}

export function buildLiquidOutline(chords, circleRadius, borderThickness, options = {}) {
  const o = { ...LIQUID_DEFAULTS, ...options };
  const { field, nx, ny, h, ext, evalAt, approxError } = liquidField(chords, circleRadius, o);
  // d3-contour: polygons enclosing values >= threshold, i.e. the voids.
  const mp = contours().size([nx, ny]).smooth(true).thresholds([0])(field)[0];
  const loops = [];
  for (const poly of mp.coordinates) {
    const ring = poly[0].slice(0, -1).map(([gx, gy]) => [-ext + (gx - 0.5) * h, -ext + (gy - 0.5) * h]);
    if (ring.length < 8) continue;
    const ccw = ensureCCW(ring);
    if (Math.abs(signedArea(ccw)) < o.minArea) continue;
    // Largest inscribed radius ≈ max field value inside the void.
    let maxF = maxInside(ccw, (i, j) => field[j * nx + i], nx, ny, h, ext);
    // Near the cut-off, interpolated values could tip the decision: redo
    // this void with exact values (rare, and only small voids).
    if (maxF < o.minVoidRadius && maxF > o.minVoidRadius - approxError) {
      maxF = maxInside(ccw, (i, j) => evalAt(-ext + i * h, -ext + j * h), nx, ny, h, ext);
    }
    if (maxF < o.minVoidRadius) continue;
    const smooth = taubinSmooth(resampleLoop(ccw, 0.4), 3);
    // The limiter lands a little under its target, so aim 25% high.
    loops.push(fitC2Loop(limitTipRadius(smooth, o.minTipRadius * 1.25, 0.3)));
  }
  return toOutlineData(loops, circleRadius, borderThickness);
}

// Max field value over grid nodes inside a ring, by scanline: each ring edge
// drops its x crossing into the rows it spans, then each row is scanned
// between pairs of crossings. Linear in ring size plus covered cells.
function maxInside(ring, value, nx, ny, h, ext) {
  const rows = new Map();
  const n = ring.length;
  for (let a = 0, b = n - 1; a < n; b = a++) {
    const ya = ring[a][1], yb = ring[b][1];
    if (ya === yb) continue;
    const lo = Math.min(ya, yb), hi = Math.max(ya, yb);
    // rows whose y = -ext + j*h lies in [lo, hi): half-open, so a vertex
    // shared by two edges is counted once
    const j0 = Math.ceil((lo + ext) / h), j1 = Math.ceil((hi + ext) / h) - 1;
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) {
      const y = -ext + j * h;
      const x = ring[a][0] + (y - ya) * (ring[b][0] - ring[a][0]) / (yb - ya);
      let r = rows.get(j);
      if (!r) rows.set(j, r = []);
      r.push(x);
    }
  }
  let maxF = 0;
  for (const [j, xs] of rows) {
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] + ext) / h)), i1 = Math.min(nx - 1, Math.floor((xs[k + 1] + ext) / h));
      for (let i = i0; i <= i1; i++) { const v = value(i, j); if (v > maxF) maxF = v; }
    }
  }
  return maxF;
}
