// ?perf=1: how smoothly the pendant's arrival plays on this device.
//
// Each stage (the 2D outline thickening, the wait for the 3D, the gold
// flowing in, the drain) is a span. While a span is open the length of every
// animation frame is recorded, and when the gold has arrived the run is
// summed up in a small panel on the page (readable on a phone, no dev tools
// needed), in the console, and in window.__perf.runs.
//
// ?perf=1&slow=3 makes this device stand in for one about 3x slower: the
// page's own drawing and outline builds take 3x as long (by spinning after
// each one) and the 3D shades 3x the pixels. It is a stand-in, not an
// emulator, but a run that passes at slow=3 on a new phone is a fair sign
// for a phone several years older.

export interface PerfSpan {
  name: string;
  ms: number;          // how long the stage took
  designMs: number;    // how long it is meant to take (0: as short as possible)
  frames: number;
  fps: number;
  p95: number;         // 95% of frames were shorter than this
  worst: number;
  dropped: number;     // share of frames that overran the display's own interval, 0 to 1
  ok: boolean;
}

export interface PerfMeter {
  on: boolean;
  slow: number;
  // Open a span. With `until`, it closes itself on the first frame where that returns true.
  begin(name: string, designMs?: number, until?: () => boolean): void;
  end(name: string): void;
  // Run a piece of the page's own work, timed (and stretched by `slow`).
  work<T>(name: string, fn: () => T): T;
  note(key: string, value: string | number): void;
  // Sum up the spans closed since the last report.
  report(): void;
}

// Frames this much longer than the display's interval count as dropped.
const DROP = 1.5;
// A stage passes when it drops no more than this share of its frames and
// does not run this much over its designed length.
const MAX_DROPPED = 0.1;
const MAX_OVERRUN = 1.2;

const OFF: PerfMeter = {
  on: false, slow: 1,
  begin() {}, end() {}, work: (_name, fn) => fn(), note() {}, report() {},
};

export function spin(ms: number) {
  const until = performance.now() + ms;
  while (performance.now() < until) { /* burn */ }
}

export function createPerfMeter(urlParams: URLSearchParams): PerfMeter {
  if (urlParams.get('perf') !== '1') return OFF;
  const slow = Math.min(8, Math.max(1, parseFloat(urlParams.get('slow') || '1') || 1));

  const open = new Map<string, { start: number; designMs: number; until?: () => boolean; deltas: number[] }>();
  const work = new Map<string, { n: number; total: number; max: number }>();
  const notes = new Map<string, string | number>();
  let closed: PerfSpan[] = [];
  let interval = 1000 / 60;   // the display's frame interval, learned from the shortest frames seen
  let raf = 0, last = 0;
  let panel: HTMLPreElement | null = null;
  const runs: unknown[] = [];
  (window as any).__perf = { runs, slow };

  const tick = (now: number) => {
    raf = 0;
    const dt = now - last;
    last = now;
    for (const [name, s] of open) {
      if (now > s.start) s.deltas.push(dt);
      if (s.until?.()) end(name);
    }
    if (open.size) raf = requestAnimationFrame(tick);
  };

  function begin(name: string, designMs = 0, until?: () => boolean) {
    open.set(name, { start: performance.now(), designMs, until, deltas: [] });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function end(name: string) {
    const s = open.get(name);
    if (!s) return;
    open.delete(name);
    const ms = performance.now() - s.start;
    const d = s.deltas.slice().sort((a, b) => a - b);
    if (d.length >= 8) interval = Math.min(interval, Math.max(4, d[Math.floor(d.length * 0.1)]));
    const dropped = d.length ? d.filter((x) => x > interval * DROP).length / d.length : 0;
    closed.push({
      name, ms, designMs: s.designMs, frames: d.length,
      fps: d.length ? (d.length * 1000) / d.reduce((a, b) => a + b, 0) : 0,
      p95: d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] : 0,
      worst: d.length ? d[d.length - 1] : 0,
      dropped,
      ok: dropped <= MAX_DROPPED && (!s.designMs || ms <= s.designMs * MAX_OVERRUN),
    });
  }

  function timed<T>(name: string, fn: () => T): T {
    const t0 = performance.now();
    const out = fn();
    let dt = performance.now() - t0;
    if (slow > 1) { spin(dt * (slow - 1)); dt *= slow; }
    let w = work.get(name);
    if (!w) work.set(name, w = { n: 0, total: 0, max: 0 });
    w.n++; w.total += dt; w.max = Math.max(w.max, dt);
    return out;
  }

  function report() {
    if (!closed.length) return;
    const spans = closed;
    closed = [];
    const f = (x: number, n = 0) => x.toFixed(n);
    const lines = [
      `${f(1000 / interval)} Hz display, dpr ${window.devicePixelRatio}, ${navigator.hardwareConcurrency || '?'} cores${slow > 1 ? `, slowed ${slow}x` : ''}`,
      ...spans.map((s) =>
        `${s.ok ? 'ok  ' : 'SLOW'} ${s.name.padEnd(8)} ${f(s.ms).padStart(5)} ms${s.designMs ? ` of ${s.designMs}` : ''}` +
        (s.frames ? `  ${f(s.fps)} fps  p95 ${f(s.p95)}  worst ${f(s.worst)}  dropped ${f(s.dropped * 100)}%` : '')),
      ...[...work].map(([name, w]) => `     ${name.padEnd(8)} ${f(w.total / w.n, 1)} ms each, worst ${f(w.max, 1)} (${w.n})`),
      ...[...notes].map(([k, v]) => `     ${k}: ${v}`),
    ];
    runs.push({ spans, work: Object.fromEntries(work), notes: Object.fromEntries(notes), interval, slow });
    work.clear();
    console.log('[perf]\n' + lines.join('\n'));
    if (!panel) {
      panel = document.createElement('pre');
      panel.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:9999;margin:0;padding:6px 8px;max-width:calc(100vw - 12px);overflow:auto;' +
        'font:10px/1.35 ui-monospace,Menlo,monospace;color:#f6f1ea;background:rgba(58,56,52,.88);border-radius:6px;pointer-events:none;white-space:pre;';
      document.body.appendChild(panel);
    }
    panel.textContent = lines.join('\n');
  }

  return { on: true, slow, begin, end, work: timed, note: (k, v) => { notes.set(k, v); }, report };
}
