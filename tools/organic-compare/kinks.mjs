// Sweep many charts and look for kinks in an outline's void boundaries.
// node tools/organic-compare/kinks.mjs <liquid|pebble> [count] [optionsJSON]
// A void boundary should only ever bend one way (convex, seen from inside the
// void): along the rim, at bar junctions and at crossings. Any stretch that
// bends the other way more tightly than BUMP_R is metal bulging into the void,
// i.e. a bump, ledge or wobble. Also checks tangent breaks between curve
// segments and tight tips.
import { chordsFor } from './charts.mjs';
import { buildLiquidOutline } from '../../modules/organic/outline-liquid.js';
import { buildPebbleOutline } from '../../modules/organic/outline-pebble.js';
import { castabilityMetrics, outlineDataToLoops } from '../../modules/organic/outline-common.js';

const [alg, countArg, optArg] = process.argv.slice(2);
const count = +(countArg || 200);
const opts = optArg ? JSON.parse(optArg) : {};
const build = { liquid: buildLiquidOutline, pebble: buildPebbleOutline }[alg];
const BUMP_R = +(process.env.BUMP_R || 12), MIN_RUN = 0.6, R = 100;

function d1(b, t) { const u = 1 - t; return [0, 1].map(k => 3 * (u * u * (b[1][k] - b[0][k]) + 2 * u * t * (b[2][k] - b[1][k]) + t * t * (b[3][k] - b[2][k]))); }
function d2(b, t) { const u = 1 - t; return [0, 1].map(k => 6 * (u * (b[2][k] - 2 * b[1][k] + b[0][k]) + t * (b[3][k] - 2 * b[2][k] + b[1][k]))); }
function pt(b, t) { const u = 1 - t; return [0, 1].map(k => u * u * u * b[0][k] + 3 * u * u * t * b[1][k] + 3 * u * t * t * b[2][k] + t * t * t * b[3][k]); }
const kappa = (b, t) => { const v = d1(b, t), a = d2(b, t); const s = Math.hypot(v[0], v[1]); return s < 1e-9 ? 0 : (v[0] * a[1] - v[1] * a[0]) / (s * s * s); };

export function analyse(data) {
  const out = { bumps: [], breaks: 0, minTip: Infinity, maxBreakDeg: 0, jumps: 0 };
  for (const ch of data.voidChains) {
    const segs = ch.links.map(l => [l.p0, l.c1, l.c2, l.p3]);
    // concave runs
    let run = 0, runMin = Infinity, runAt = null;
    const flush = () => { if (run >= MIN_RUN) out.bumps.push({ r: 1 / runMin, at: runAt, rimDist: R - Math.hypot(runAt[0], runAt[1]) }); run = 0; runMin = Infinity; runAt = null; };
    for (let i = 0; i < segs.length; i++) {
      const b = segs[i], N = 32;
      for (let j = 0; j < N; j++) {
        const t = (j + 0.5) / N, k = kappa(b, t);
        const v = d1(b, t), ds = Math.hypot(v[0], v[1]) / N;
        if (k > 0) out.minTip = Math.min(out.minTip, 1 / k);
        if (k < -1 / BUMP_R) { run += ds; if (-k < runMin || true) { if (1 / -k < (runAt ? 1 / runMin : Infinity)) { runMin = -k; runAt = pt(b, t); } } }
        else flush();
      }
      const nb = segs[(i + 1) % segs.length];
      const a = d1(b, 1), c = d1(nb, 0);
      const ang = Math.abs(Math.atan2(a[0] * c[1] - a[1] * c[0], a[0] * c[0] + a[1] * c[1])) * 180 / Math.PI;
      out.maxBreakDeg = Math.max(out.maxBreakDeg, ang);
      if (ang > 2) out.breaks++;
      // Curvature jump at the join: visible as a kink in reflections when the
      // curvature changes by more than half of its size (and the bend matters).
      const k0 = kappa(b, 1), k1 = kappa(nb, 0), big = Math.max(Math.abs(k0), Math.abs(k1));
      if (big > 1 / 25 && Math.abs(k0 - k1) > 0.5 * big) out.jumps++;
    }
    flush();
  }
  return out;
}

const days = [];
for (let i = 0; i < count; i++) { const d = new Date(Date.UTC(1950, 0, 1) + i * 97.3 * 86400000); days.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate(), hour: (i * 7) % 24, minute: 30, lat: 40.71, lon: -74.0 }); }
let jumps = 0, charts = 0, withBumps = 0, nb = 0, withBreaks = 0, minTip = Infinity, minWire = Infinity, worst = [], ms = 0, maxMs = 0;
for (const d of days) {
  if (process.env.ONLY && !process.env.ONLY.split(",").includes(`${d.year}-${d.month}-${d.date}`)) continue;
  const ch = chordsFor(d);
  if (ch.length === 0) continue;
  const t0 = performance.now();
  const data = build(ch, R, 8, opts);
  const dt = performance.now() - t0; ms += dt; maxMs = Math.max(maxMs, dt);
  const a = analyse(data);
  const m = castabilityMetrics(outlineDataToLoops(data), R, 8);
  charts++; minWire = Math.min(minWire, m.minWire);
  if (a.bumps.length) { withBumps++; nb += a.bumps.length; worst.push({ day: `${d.year}-${d.month}-${d.date} ${d.hour}:30`, n: a.bumps.length, r: Math.min(...a.bumps.map(b => b.r)).toFixed(1), rim: a.bumps.map(b => b.rimDist.toFixed(0)).join(','), at: a.bumps.map(b => b.at.map(v => +v.toFixed(1))) }); }
  if (a.breaks) withBreaks++;
  jumps += a.jumps;
  minTip = Math.min(minTip, a.minTip);
}
worst.sort((p, q) => p.r - q.r);
console.log(JSON.stringify({ alg, opts, charts, withBumps, bumps: nb, withBreaks, curvatureJumps: jumps, minTip: +minTip.toFixed(2), minWire: +minWire.toFixed(2), avgMs: Math.round(ms / charts), maxMs: Math.round(maxMs), worst: worst.slice(0, 8) }));
