// outline-common.js
// Shared helpers for the organic outline algorithms (pure JS, no DOM).
//
// Every organic algorithm returns the same "outline data" shape that
// buildPendant3D() in replicad-pipeline.js consumes:
//   { circleRadius, borderThickness, voidChains: [{ links: [...], area }] }
// where links may now also be { type: 'bezier', p0, c1, c2, p3 } (cubic).
// Void loops are counter-clockwise.

export const TAU = Math.PI * 2;

// ── Basic polygon helpers ───────────────────────────────────────────────

export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function loopLength(pts) {
  let L = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    L += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return L;
}

export function ensureCCW(pts) {
  return signedArea(pts) < 0 ? pts.slice().reverse() : pts;
}

export function circlePolygon(r, n = 256, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Chord endpoints on the circle of radius r.
// [p, q, w] per chord. `w` (default 1) scales a bar's width, for the
// grow-in animations; bars at w <= 0 are left out.
export function chordSegments(chords, r) {
  const segs = [];
  for (const c of chords) {
    const w = c.w ?? 1;
    if (!(w > 0)) continue;
    const p = [Math.cos(c.a1) * r, Math.sin(c.a1) * r];
    const q = [Math.cos(c.a2) * r, Math.sin(c.a2) * r];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
    segs.push([p, q, w]);
  }
  return segs;
}

// Smallest interior angle (degrees) of a closed polygon, ignoring
// near-straight vertices produced by sampling.
export function minInteriorAngle(pts) {
  let minA = 180;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI;
    if (ang < minA) minA = ang;
  }
  return minA;
}

// Resample a closed polyline at (roughly) uniform arc-length spacing.
export function resampleLoop(pts, spacing) {
  const L = loopLength(pts);
  const n = Math.max(8, Math.round(L / spacing));
  const step = L / n;
  const out = [];
  let seg = 0, segStart = 0;
  const N = pts.length;
  let segLen = Math.hypot(pts[1 % N][0] - pts[0][0], pts[1 % N][1] - pts[0][1]);
  for (let k = 0; k < n; k++) {
    const s = k * step;
    while (segStart + segLen < s && seg < N - 1) {
      segStart += segLen;
      seg++;
      const p = pts[seg], q = pts[(seg + 1) % N];
      segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    const p = pts[seg], q = pts[(seg + 1) % N];
    const t = segLen > 1e-12 ? (s - segStart) / segLen : 0;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

// Light Laplacian smoothing (Taubin lambda/mu to avoid shrinkage).
export function taubinSmooth(pts, iterations = 4, lambda = 0.5, mu = -0.53) {
  let cur = pts;
  const n = pts.length;
  for (let it = 0; it < iterations; it++) {
    for (const f of [lambda, mu]) {
      const next = new Array(n);
      for (let i = 0; i < n; i++) {
        const a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
        next[i] = [b[0] + f * ((a[0] + c[0]) / 2 - b[0]), b[1] + f * ((a[1] + c[1]) / 2 - b[1])];
      }
      cur = next;
    }
  }
  return cur;
}

// ── Cubic Bezier helpers ────────────────────────────────────────────────

export function bez(b, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, c = 3 * mt * mt * t, d = 3 * mt * t * t, e = t * t * t;
  return [a * b[0][0] + c * b[1][0] + d * b[2][0] + e * b[3][0],
          a * b[0][1] + c * b[1][1] + d * b[2][1] + e * b[3][1]];
}
function bezD1(b, t) {
  const mt = 1 - t;
  return [3 * mt * mt * (b[1][0] - b[0][0]) + 6 * mt * t * (b[2][0] - b[1][0]) + 3 * t * t * (b[3][0] - b[2][0]),
          3 * mt * mt * (b[1][1] - b[0][1]) + 6 * mt * t * (b[2][1] - b[1][1]) + 3 * t * t * (b[3][1] - b[2][1])];
}
function bezD2(b, t) {
  const mt = 1 - t;
  return [6 * mt * (b[2][0] - 2 * b[1][0] + b[0][0]) + 6 * t * (b[3][0] - 2 * b[2][0] + b[1][0]),
          6 * mt * (b[2][1] - 2 * b[1][1] + b[0][1]) + 6 * t * (b[3][1] - 2 * b[2][1] + b[1][1])];
}

// Sample a loop of cubic Beziers into a polyline (for metrics / SVG checks).
export function sampleBezierLoop(segs, perSeg = 12) {
  const out = [];
  for (const b of segs) for (let i = 0; i < perSeg; i++) out.push(bez(b, i / perSeg));
  return out;
}

// Min radius of curvature on a Bezier loop.
export function minCurvatureRadius(segs, perSeg = 16) {
  let minR = Infinity;
  for (const b of segs) {
    for (let i = 0; i <= perSeg; i++) {
      const t = i / perSeg;
      const d1 = bezD1(b, t), d2 = bezD2(b, t);
      const cross = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);
      const sp = Math.hypot(d1[0], d1[1]);
      if (cross < 1e-12) continue;
      const R = sp * sp * sp / cross;
      if (R < minR) minR = R;
    }
  }
  return minR;
}

// ── Output assembly ─────────────────────────────────────────────────────

export function toOutlineData(bezierLoops, circleRadius, borderThickness) {
  const voidChains = [];
  for (const segs of bezierLoops) {
    const poly = sampleBezierLoop(segs, 6);
    const area = signedArea(poly);
    let s = segs;
    if (area < 0) s = segs.slice().reverse().map(b => [b[3], b[2], b[1], b[0]]);
    voidChains.push({
      area: Math.abs(area),
      links: s.map(b => ({ type: 'bezier', p0: b[0], c1: b[1], c2: b[2], p3: b[3] })),
    });
  }
  return { circleRadius, borderThickness, voidChains };
}

// Convert MakerJS-serialized chain data (lines/arcs) or bezier data to
// polylines, for metrics and SVG preview.
export function outlineDataToLoops(data, facet = 0.4) {
  const loops = [];
  for (const ch of data.voidChains) {
    const pts = [];
    for (const l of ch.links) {
      if (l.type === 'bezier') {
        const b = [l.p0, l.c1, l.c2, l.p3];
        const len = Math.hypot(l.p3[0] - l.p0[0], l.p3[1] - l.p0[1]) + 1;
        const k = Math.max(4, Math.ceil(len / facet));
        for (let i = 0; i < k; i++) pts.push(bez(b, i / k));
      } else if (l.type === 'line') {
        const s = l.reversed ? l.end : l.origin, e = l.reversed ? l.origin : l.end;
        const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
        const k = Math.max(1, Math.ceil(len / facet));
        for (let i = 0; i < k; i++) pts.push([s[0] + (e[0] - s[0]) * i / k, s[1] + (e[1] - s[1]) * i / k]);
      } else if (l.type === 'arc') {
        let span = l.endAngle - l.startAngle;
        if (span < 0) span += 360;
        const k = Math.max(2, Math.ceil((span * Math.PI / 180 * l.radius) / facet));
        for (let i = 0; i < k; i++) {
          const f = i / k;
          const a = (l.reversed ? l.endAngle - span * f : l.startAngle + span * f) * Math.PI / 180;
          pts.push([l.origin[0] + l.radius * Math.cos(a), l.origin[1] + l.radius * Math.sin(a)]);
        }
      }
    }
    if (pts.length >= 3) loops.push(pts);
  }
  return loops;
}

// Castability metrics on void loops (polylines):
//   minWire  — thinnest metal between two voids, or between a void and the
//              outer edge of the border
//   minVoid  — smallest void area
export function castabilityMetrics(loops, circleRadius, borderThickness = 0) {
  const pts = [];
  loops.forEach((loop, li) => {
    const rs = resampleLoop(loop, 0.35);
    for (const p of rs) pts.push([p[0], p[1], li]);
  });
  // Spatial hash
  const cell = 4;
  const grid = new Map();
  const key = (x, y) => (Math.floor(x / cell) + 1000) * 4096 + (Math.floor(y / cell) + 1000);
  for (const p of pts) {
    const k = key(p[0], p[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  let minWire = Infinity;
  for (const p of pts) {
    const toRim = circleRadius + borderThickness - Math.hypot(p[0], p[1]);
    if (toRim < minWire) minWire = toRim;
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const list = grid.get((cx + dx + 1000) * 4096 + (cy + dy + 1000));
      if (!list) continue;
      for (const q of list) {
        if (q[2] === p[2]) continue;
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < minWire) minWire = d;
      }
    }
  }
  let minVoid = Infinity;
  for (const l of loops) minVoid = Math.min(minVoid, Math.abs(signedArea(l)));
  return { minWire, minVoid, voidCount: loops.length };
}

// ── SVG preview ─────────────────────────────────────────────────────────

export function outlineSVG(loops, circleRadius, borderThickness, opts = {}) {
  const R = circleRadius + borderThickness;
  const pad = 4;
  const fill = opts.fill || '#1f1b16';
  const bg = opts.bg || 'none';
  const f = v => v.toFixed(2);
  let d = `M ${f(R)} 0 A ${f(R)} ${f(R)} 0 1 0 ${f(-R)} 0 A ${f(R)} ${f(R)} 0 1 0 ${f(R)} 0 Z `;
  for (const loop of loops) {
    d += 'M ' + loop.map(p => f(p[0]) + ' ' + f(-p[1])).join(' L ') + ' Z ';
  }
  const vb = `${f(-R - pad)} ${f(-R - pad)} ${f(2 * R + 2 * pad)} ${f(2 * R + 2 * pad)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${bg !== 'none' ? ` style="background:${bg}"` : ''}><path fill="${fill}" fill-rule="evenodd" d="${d}"/></svg>`;
}

// Round off needle-like tips: wherever the (CCW) void outline turns convexly
// tighter than rMin, nudge the point toward its neighbours. This only ever
// shrinks a void, so wires never get thinner. Tight void tips are fragile
// in the casting investment and hard to polish into.
export function limitTipRadius(loop, rMin = 1.2, spacing = 0.3, maxIter = 400) {
  let pts = resampleLoop(loop, spacing);
  // Same Jacobi iteration as before, but a point is only re-tested when it
  // or a neighbour moved in the last pass (otherwise its answer can't
  // change), and the full set is re-tested after each resample.
  let active = null; // null = test every point
  const moves = [];
  for (let it = 0; it < maxIter; it++) {
    const n = pts.length;
    moves.length = 0;
    const test = (i) => {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const abx = b[0] - a[0], aby = b[1] - a[1], bcx = c[0] - b[0], bcy = c[1] - b[1];
      const cross = abx * bcy - aby * bcx;
      if (cross <= 0) return; // concave (or straight) on a CCW void: leave it
      const ab = Math.hypot(abx, aby), bc = Math.hypot(bcx, bcy), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const R = (ab * bc * ca) / (2 * Math.abs(cross));
      if (R >= rMin) return;
      moves.push(i, b[0] + 0.5 * ((a[0] + c[0]) / 2 - b[0]), b[1] + 0.5 * ((a[1] + c[1]) / 2 - b[1]));
    };
    if (active === null) for (let i = 0; i < n; i++) test(i);
    else for (const i of active) test(i);
    if (!moves.length) break;
    const next = new Set();
    for (let k = 0; k < moves.length; k += 3) {
      const i = moves[k];
      pts[i] = [moves[k + 1], moves[k + 2]];
      next.add((i - 1 + n) % n); next.add(i); next.add((i + 1) % n);
    }
    active = Array.from(next).sort((x, y) => x - y);
    if (it % 20 === 19) { pts = resampleLoop(pts, spacing); active = null; }
  }
  return pts;
}

// ── Curvature-continuous fitting ────────────────────────────────────────

// Periodic uniform cubic B-spline (control points P) → exact cubic Beziers.
// Neighbouring pieces share position, tangent and curvature (C2).
export function bsplineToBeziers(P) {
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

// Fit a closed polyline with a C2 curve. Knots are placed more densely
// where the outline bends (step ≈ stepPerRadius × local bend radius,
// clamped) and used directly as the control points of a periodic cubic
// B-spline. Unlike the Schneider fit, joins are curvature-continuous, so
// reflections on polished metal don't crease at each join. And unlike an
// interpolating spline it can't overshoot: the curve stays inside the
// control polygon's corners, so tips only get blunter (never sharper) and
// no wobble is added. On a bend of radius R it sits ≈ stepPerRadius² R / 6
// inside the input.
export function fitC2Loop(loop, { minStep = 0.5, maxStep = 9, stepPerRadius = 0.35, maxRatio = 1.4 } = {}) {
  const pts = resampleLoop(loop, 0.25);
  const n = pts.length;
  const w = 4;
  const rad = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - w + n) % n], b = pts[i], c = pts[(i + w) % n];
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let da = Math.abs(t2 - t1); if (da > Math.PI) da = 2 * Math.PI - da;
    rad[i] = da < 1e-6 ? 1e6 : (w * 0.25) / da; // chord turn = chord / R
  }
  // Smallest radius nearby (growing with distance), so steps shrink ahead
  // of a tight bend and grow gradually after it.
  const reach = Math.ceil(maxStep / 0.25);
  const want = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let r = Infinity;
    for (let j = -reach; j <= reach; j++) r = Math.min(r, rad[(i + j + n) % n] + Math.abs(j) * 0.25 * (maxRatio - 1) / stepPerRadius);
    want[i] = Math.min(maxStep, Math.max(minStep, stepPerRadius * r));
  }
  const knots = [];
  let i = 0, walked = 0;
  const total = n * 0.25;
  while (walked < total - 0.5 * want[i % n]) {
    knots.push(pts[i % n]);
    const step = want[i % n];
    let d = 0;
    while (d < step && walked < total) { i++; d += 0.25; walked += 0.25; }
  }
  if (knots.length < 4) return bsplineToBeziers(resampleLoop(loop, Math.max(0.5, loopLength(loop) / 8)));
  return bsplineToBeziers(knots);
}
