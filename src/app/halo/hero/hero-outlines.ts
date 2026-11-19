// The hero's 2D outline thickens through frames made ahead of time, one file
// per sky (public/hero/outlines/NN.bin), instead of being built in a worker
// while it animates. So it can have many more steps than a device could keep
// up with, and it costs nothing at play time. The files are made by the
// homepage in dev (/?outlines=1, see bakeOutlines) and must be remade when
// the pendant's defaults change: settings.json beside them records what they
// were made for, and if that no longer matches they are ignored (the engine
// then builds live).
//
// A file is a list of 16-bit integers: the number of frames; then for each
// frame its number of loops; then for each loop its number of points and
// their x, y, in fiftieths of a unit (the pendant's rim is 100 units out).
import { PENDANT_DEFAULTS } from '@/config/pendant-params';
import type { ChartEngine } from '@/app/chart/chart-engine';
import { HERO_SKIES } from './hero-director';

type Frames = number[][][][];              // frames > loops > points > [x, y]
const STEPS = 48;                          // frames per outline; the live build manages 20
const SCALE = 50;                          // stored integers per unit
const TOLERANCE = 0.06;                    // points are dropped where the line through their neighbours passes this close (units)
const url = (i: number) => `/hero/outlines/${String(i).padStart(2, '0')}.bin`;
const settings = () => JSON.stringify(PENDANT_DEFAULTS);

function decode(buffer: ArrayBuffer): Frames {
  const v = new Int16Array(buffer);
  let at = 0;
  const frames: Frames = [];
  for (let f = v[at++]; f > 0; f--) {
    const loops: number[][][] = [];
    for (let l = v[at++]; l > 0; l--) {
      const pts: number[][] = [];
      for (let n = v[at++]; n > 0; n--) { pts.push([v[at] / SCALE, v[at + 1] / SCALE]); at += 2; }
      loops.push(pts);
    }
    frames.push(loops);
  }
  return frames;
}

// A closed loop with the points that add nothing dropped (Douglas-Peucker).
function thin(pts: number[][]): number[][] {
  if (pts.length < 8) return pts;
  const keep = new Uint8Array(pts.length);
  const far = pts.reduce((best, p, i) => (Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[best][0] - pts[0][0], pts[best][1] - pts[0][1]) ? i : best), 0);
  keep[0] = keep[far] = 1;
  const split = (a: number, b: number) => {
    const [ax, ay] = pts[a], [bx, by] = pts[b % pts.length], len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * (by - ay) - (pts[i][1] - ay) * (bx - ax)) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > TOLERANCE) { keep[at] = 1; split(a, at); split(at, b); }
  };
  split(0, far);
  split(far, pts.length);
  return pts.filter((_, i) => keep[i]);
}

function encode(frames: Frames): Int16Array {
  const out: number[] = [frames.length];
  for (const loops of frames) {
    out.push(loops.length);
    for (const loop of loops) {
      const pts = thin(loop);
      out.push(pts.length);
      for (const [x, y] of pts) out.push(Math.round(x * SCALE), Math.round(y * SCALE));
    }
  }
  return Int16Array.from(out);
}

// Holds the baked frames and says which sky's are wanted now.
export class OutlineStore {
  private frames: (Frames | null | undefined)[] = [];
  private sky = -1;
  private valid: Promise<boolean> | null = null;

  // Fetch a sky's frames, if not already here. Resolves either way.
  async load(i: number) {
    if (this.frames[i] !== undefined) return;
    this.frames[i] = null;
    try {
      this.valid ??= fetch('/hero/outlines/settings.json').then((r) => (r.ok ? r.text() : '')).then((t) => t === settings()).catch(() => false);
      if (!(await this.valid)) return;
      const file = await fetch(url(i));
      if (file.ok) this.frames[i] = decode(await file.arrayBuffer());
    } catch {}
  }

  // The sky about to be drawn; the one after it is fetched ahead.
  use(i: number) { this.sky = i; this.load((i + 1) % HERO_SKIES.length); }

  // For the engine's growFrames option.
  current = () => this.frames[this.sky] || null;
}

export interface OutlineBakeStatus { done: number; finished: boolean; bytes: number[]; error?: string }

// Draws each of the hero's skies with the live engine at STEPS steps and saves the outline's frames.
export async function bakeOutlines(engine: ChartEngine, canvas: HTMLCanvasElement, status: OutlineBakeStatus) {
  const save = (name: string, body: BodyInit) => fetch(`/api/lab/bake?name=outlines/${name}`, { method: 'POST', body }).then((r) => { if (!r.ok) throw new Error(`saving ${name}: ${r.status}`); });
  try {
    for (let i = 0; i < HERO_SKIES.length; i++) {
      const grown = new Promise<void>((ok) => canvas.addEventListener('outline-grown', () => ok(), { once: true }));
      engine.setBirth(HERO_SKIES[i]);
      await grown;
      const frames = engine.lastGrowFrames();
      if (!frames || frames.length !== STEPS || frames.some((f) => !f)) throw new Error(`sky ${i}: ${frames?.filter(Boolean).length ?? 0} of ${STEPS} frames`);
      const body = encode(frames);
      await save(`${String(i).padStart(2, '0')}.bin`, new Blob([body.buffer as ArrayBuffer]));
      status.bytes.push(body.byteLength);
      status.done = i + 1;
      await new Promise((ok) => setTimeout(ok, 2500));   // let the pendant land before the next sky
    }
    await save('settings.json', settings());
    status.finished = true;
  } catch (err) {
    status.error = String((err as Error)?.message || err);
  }
}
export const OUTLINE_STEPS = STEPS;
