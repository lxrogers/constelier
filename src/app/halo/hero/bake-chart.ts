// Bakes the chart engine's 2D animation to image frames for the Blender film
// (tools/blender/film.py). The page's clock is replaced by one stepped by
// hand, so every frame is drawn at an exact moment however long it takes to
// save, and the frames go to /api/lab/bake.
import type { ChartEngine } from '@/app/chart/chart-engine';

const STEP_MS = 1000 / 60;     // engine time between frames
const TAIL_MS = 5600;          // keep going this long after the outline has thickened (the dots keep moving under the gold)

export interface BakeClock { now: number; step(ms: number): void }

// Must run before the chart engine loads: it takes over requestAnimationFrame and performance.now.
export function installBakeClock(): BakeClock {
  let now = 0, seq = 0;
  const queue = new Map<number, FrameRequestCallback>();
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { queue.set(++seq, cb); return seq; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };
  return {
    get now() { return now; },
    step(ms: number) {
      now += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) cb(now);
    },
  };
}

// Real time passing, without timers (which a background tab slows to one a second).
function wait(ms: number) {
  const until = Date.now() + ms;
  return new Promise<void>((done) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { if (Date.now() >= until) done(); else channel.port2.postMessage(0); };
    channel.port2.postMessage(0);
  });
}

export interface BakeStatus { frames: number; done: boolean; error?: string }

// Steps the engine from the moment a new birth is set until well after its
// outline has thickened, saving the 2D canvas at every step.
export async function bakeChart(engine: ChartEngine, canvas: HTMLCanvasElement, clock: BakeClock, setBirth: () => void, status: BakeStatus) {
  const save = (name: string, body: BodyInit) => fetch(`/api/lab/bake?name=${name}`, { method: 'POST', body }).then((r) => { if (!r.ok) throw new Error(`saving ${name}: ${r.status}`); });
  const marks: Record<string, number> = {};
  canvas.addEventListener('aspects-updated', () => { marks.lines ??= clock.now; });
  canvas.addEventListener('outline-grown', () => { marks.grown ??= clock.now; });
  const times: number[] = [];
  try {
    // The birth is set at once, as the hero does: the first frame is the opening chart, and the planets set off from it.
    marks.change = clock.now;
    setBirth();
    while (!(marks.grown && clock.now > marks.grown + TAIL_MS) && times.length < 1400) {
      const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b), 'image/png'));
      await save(`chart/f${String(times.length).padStart(4, '0')}.png`, blob);
      times.push(Math.round(clock.now * 100) / 100);
      status.frames = times.length;
      clock.step(STEP_MS);
      // The outline's steps are built in a worker in real time; give it room so none is skipped.
      await wait(marks.lines && !marks.grown ? 60 : 6);
    }
    await save('chart.json', JSON.stringify({ size: canvas.width, half: engine.chartHalf(), stepMs: STEP_MS, marks, times }));
    status.done = true;
  } catch (err) {
    status.error = String((err as Error)?.message || err);
  }
}
