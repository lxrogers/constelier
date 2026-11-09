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
export function chordSegments(chords, r) {
  const segs = [];
  for (const c of chords) {
    const p = [Math.cos(c.a1) * r, Math.sin(c.a1) * r];
    const q = [Math.cos(c.a2) * r, Math.sin(c.a2) * r];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) continue;
    segs.push([p, q]);
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

// ── Schneider curve fitting (closed loop → cubic Beziers, G1 joins) ─────

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function mul(a, s) { return [a[0] * s, a[1] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function norm(a) { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }

function chordParams(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = u[u.length - 1] || 1;
  return u.map(x => x / L);
}

function generateBezier(pts, u, t1, t2) {
  const p0 = pts[0], p3 = pts[pts.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], mt = 1 - t;
    const b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
    const A1 = mul(t1, b1), A2 = mul(t2, b2);
    c00 += dot(A1, A1); c01 += dot(A1, A2); c11 += dot(A2, A2);
    const tmp = sub(pts[i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(A1, tmp); x1 += dot(A2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let a1 = 0, a2 = 0;
  if (Math.abs(det) > 1e-12) { a1 = (x0 * c11 - x1 * c01) / det; a2 = (c00 * x1 - c01 * x0) / det; }
  const segLen = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
  const eps = 1e-6 * segLen;
  if (a1 < eps || a2 < eps || a1 > segLen * 2 || a2 > segLen * 2) { a1 = a2 = segLen / 3; }
  return [p0, add(p0, mul(t1, a1)), add(p3, mul(t2, a2)), p3];
}

function reparam(b, pts, u) {
  return u.map((t, i) => {
    const d = sub(bez(b, t), pts[i]);
    const d1 = bezD1(b, t), d2 = bezD2(b, t);
    const num = dot(d, d1), den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.min(1, Math.max(0, t - num / den));
  });
}

function maxError(b, pts, u) {
  let maxD = 0, idx = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = bez(b, u[i]);
    const d = (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2;
    if (d > maxD) { maxD = d; idx = i; }
  }
  return [maxD, idx];
}

function fitCubic(pts, t1, t2, err, out, depth = 0) {
  if (pts.length === 2) {
    const d = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 3;
    out.push([pts[0], add(pts[0], mul(t1, d)), add(pts[1], mul(t2, d)), pts[1]]);
    return;
  }
  let u = chordParams(pts);
  let b = generateBezier(pts, u, t1, t2);
  let [e, split] = maxError(b, pts, u);
  if (e < err) { out.push(b); return; }
  if (e < err * 16) {
    for (let k = 0; k < 6; k++) {
      u = reparam(b, pts, u);
      b = generateBezier(pts, u, t1, t2);
      [e, split] = maxError(b, pts, u);
      if (e < err) { out.push(b); return; }
    }
  }
  if (depth > 24) { out.push(b); return; }
  split = Math.max(1, Math.min(pts.length - 2, split));
  const tc = norm(sub(pts[split - 1], pts[split + 1]));
  fitCubic(pts.slice(0, split + 1), t1, tc, err, out, depth + 1);
  fitCubic(pts.slice(split), mul(tc, -1), t2, err, out, depth + 1);
}

// Fit a closed, smooth polyline with G1-continuous cubic Beziers.
// tolerance is max deviation in model units.
export function fitBezierLoop(loop, tolerance = 0.08) {
  const n = loop.length;
  // Start at the point of lowest curvature-ish (largest neighbour angle) so
  // the seam lands on a calm stretch.
  let start = 0, best = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
    const s = dot(norm(sub(b, a)), norm(sub(c, b)));
    if (s > best) { best = s; start = i; }
  }
  const pts = [];
  for (let k = 0; k <= n; k++) pts.push(loop[(start + k) % n]);
  const tan = norm(sub(loop[(start + 1) % n], loop[(start - 1 + n) % n]));
  const out = [];
  fitCubic(pts, tan, mul(tan, -1), tolerance * tolerance, out);
  return out;
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
  for (let it = 0; it < maxIter; it++) {
    const n = pts.length;
    let moved = 0;
    const next = pts.map(p => p.slice());
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const abx = b[0] - a[0], aby = b[1] - a[1], bcx = c[0] - b[0], bcy = c[1] - b[1];
      const cross = abx * bcy - aby * bcx;
      if (cross <= 0) continue; // concave (or straight) on a CCW void: leave it
      const ab = Math.hypot(abx, aby), bc = Math.hypot(bcx, bcy), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const R = (ab * bc * ca) / (2 * Math.abs(cross));
      if (R >= rMin) continue;
      next[i] = [b[0] + 0.5 * ((a[0] + c[0]) / 2 - b[0]), b[1] + 0.5 * ((a[1] + c[1]) / 2 - b[1])];
      moved++;
    }
    pts = next;
    if (!moved) break;
    if (it % 20 === 19) pts = resampleLoop(pts, spacing);
  }
  return pts;
}
