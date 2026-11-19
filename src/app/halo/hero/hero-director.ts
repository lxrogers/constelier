// Films the natal chart for the homepage hero. The chart engine draws the 2D
// chart and makes the pendant as usual; here its 2D canvas becomes paper on
// the surface under the pendant, inside the 3D scene, so one real camera can
// move over both: the drawing foreshortens, the metal's reflections shift and
// its shadow falls across the chart's lines.
//
// It runs a loop on its own: a birth is set, the planets glide round, the
// lines draw, the gold flows in, and the next birth starts. Four shots are cut
// together over it: the flat chart as the planets move; close in on the lines
// as they draw and the gold flows in; a low angle travelling across the
// finished piece; then pulling back to show it is one of twelve.
//
// The canvas never rests, so the director also looks after the device: it
// stops drawing while the hero is out of sight, and draws on fewer pixels
// when frames keep arriving late (see pace).
import * as THREE from 'three';
import { DEFAULT_PLAY, LOOKS } from '@/modules/traced-gold/traced-pendant';
import { PENDANT_DEFAULTS } from '@/config/pendant-params';
import type { ChartEngine } from '@/app/chart/chart-engine';
import { GRID, GRID_GAP, loadGrid } from './hero-grid';

// The window's shadow: the angle of its edge (degrees, 0 is left to right,
// negative runs downhill to the right), how far above the pendant's centre
// that edge passes, how far the shade reaches below the edge (at its largest
// it takes everything on that side, splitting the view in two), how soft the
// edge is (the pendant's rim is 100 from its centre), and how dark it is (0 to 1).
type Shadow = { angle: number; offset: number; width: number; soft: number; depth: number };
const SHADOW: Shadow = { angle: -24, offset: -35, width: 4000, soft: 15, depth: 0.94 };

export interface Sky { label: string; year: number; month: number; day: number; hour: number; minute: number; lat: number; lon: number }
// Real minutes, somewhere. The loop plays them in order.
export const HERO_SKIES: Sky[] = [
  { label: '15 January 1990 · New York', year: 1990, month: 1, day: 15, hour: 8, minute: 30, lat: 40.7128, lon: -74.006 },
  { label: '9 March 1968 · Paris', year: 1968, month: 3, day: 9, hour: 11, minute: 5, lat: 48.8566, lon: 2.3522 },
  { label: '21 June 2010 · Sydney', year: 2010, month: 6, day: 21, hour: 3, minute: 40, lat: -33.8688, lon: 151.2093 },
  { label: '3 December 1995 · Chicago', year: 1995, month: 12, day: 3, hour: 18, minute: 20, lat: 41.8781, lon: -87.6298 },
  { label: '27 August 1983 · Lagos', year: 1983, month: 8, day: 27, hour: 22, minute: 15, lat: 6.5244, lon: 3.3792 },
];

// Where the camera is, in the pendant's rig space: looking at (tx, ty) on the
// surface from `dist` away, `el` degrees above it and `az` degrees round it
// (270 looks up the chart from below, as the flat chart is read).
interface Cam { dist: number; el: number; az: number; tx: number; ty: number }
const FLAT: Cam = { dist: 900, el: 84, az: 270, tx: 0, ty: 0 };

const ARRIVE_MS = 3200;   // the flow-in, slower here than in the configurator
const FIRST_MS = 4800;    // the first arrival of all, rim included
const CURVE = [0.5, 0.04, 0.3, 1];   // gathers slowly, then runs, then a long settle
const STAY_S = 0.6;       // the close-up stays through the whole flow-in and this long after it, before cutting away
const PAN_S = 4.6;        // how long the low pan lasts before the cut to the grid
const GRID_S = 5;         // how long the pull-back over the grid lasts
const CUT_IN_S = 1.1;      // the cut to the close-up comes this long after the lines begin to fade in, so the flat chart has its moment
const LEAD_S = 1.0;        // the chart is shown this long before its date changes
const LATE_FRAME_MS = 25;  // a frame this long after the last one was late (a 60 Hz display shows one every 16.7)
const MIN_QUALITY = 0.55;  // the fewest pixels the canvas is ever drawn on, as a share of each dimension
const lerp = THREE.MathUtils.lerp;
const mix = (a: Cam, b: Cam, t: number): Cam => ({ dist: lerp(a.dist, b.dist, t), el: lerp(a.el, b.el, t), az: lerp(a.az, b.az, t), tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t) });

// The loop's beats: the planets moving to a new sky, its lines drawing and thickening, the gold arriving, the finished piece held.
type Beat = 'chart' | 'lines' | 'arrive' | 'hold';
type CutShot = Beat | 'grid';   // there is one more shot than there are beats: the pull-back over the grid, late in the hold

export class HeroDirector {
  private traced: any;
  private chart: THREE.CanvasTexture;
  private raf = 0;
  private last = 0;
  private clock = 0;          // seconds since the loop began
  private beat: Beat = 'chart';
  private beatAt = 0;         // clock time the current beat began
  private sky = 0;
  private cam: Cam = { ...FLAT };
  private changeAt = 0;       // clock time the next sky is due to be set, if one is
  private cutFrom: CutShot | null = null;
  private grid: THREE.Texture | null = null;   // the neighbours' pictures, once loaded
  private pitch = 0;          // how far apart the grid's pendants sit   // the shot the camera was last placed for, to cut when it changes
  private chartAt = 0;        // clock time the flat shot of the chart began
  private linesDue = 0;       // clock time the close-up is due to begin, once the lines have started
  private linesAt = 0;        // clock time the lines began to draw
  private quality = 1;        // share of the usual pixels drawn, per dimension (see pace)
  private late = 0;           // late frames in a row
  private seen = true;        // whether any of the hero is on screen
  private shown = false;      // whether a frame has been drawn yet
  private watch: IntersectionObserver;
  onSky: (sky: Sky) => void = () => {};
  onChange: (index: number) => void = () => {};   // called just before the engine is given the next sky
  onReady: () => void = () => {};   // called once, after the first frame is drawn

  // `light`: start on fewer pixels, for phones.
  constructor(private engine: ChartEngine, private viewer: any, private canvas2d: HTMLCanvasElement, private stage: HTMLCanvasElement, light = false) {
    this.traced = viewer.traced;
    if (light) { this.quality = 0.8; viewer.setQuality(this.quality); }
    this.setShadow(SHADOW);
    this.watch = new IntersectionObserver(([e]) => { this.seen = e.isIntersecting; });
    this.watch.observe(stage);
    this.traced.setLook(LOOKS.chart);
    this.traced.setThickness(PENDANT_DEFAULTS.thickness);   // the paper lies where it will once the pendant is on it, so nothing shifts when the gold arrives
    this.traced.setEnvRotation(0, 0);
    // The very first pendant arrives out of nothing, so its rim forms too, and it takes its time.
    this.traced.defaultPlay = { ...DEFAULT_PLAY, ms: ARRIVE_MS, first: { kind: 'ceremony', ms: FIRST_MS } };
    this.traced.setCurve(CURVE);
    this.chart = new THREE.CanvasTexture(canvas2d);
    this.chart.colorSpace = THREE.SRGBColorSpace;
    this.chart.anisotropy = viewer.renderer.capabilities.getMaxAnisotropy();   // the chart is seen at glancing angles
    this.traced.setChart(this.chart, engine.chartHalf());
    this.traced.object.visible = true;   // the paper and its chart, before any pendant exists
    canvas2d.addEventListener('aspects-updated', this.onLines);
    this.pitch = 2 * engine.chartHalf() * GRID_GAP;
    loadGrid().then((grid) => { if (!grid) return; if (!this.raf) { grid.dispose(); return; } this.grid = grid; this.traced.setGrid(grid, 0); });
    this.raf = requestAnimationFrame(this.tick);
  }

  // The engine says so when the planets have landed and the lines start to draw.
  // (The first chart's lines may begin before this director exists; the page says so with linesBegan.)
  linesBegan() { this.onLines(); }
  private onLines = () => { if (this.beat === 'chart' && !this.changeAt && !this.linesDue) this.linesDue = this.clock + CUT_IN_S; };

  // Which shot is on: the close-up carries on through the flow-in, so the gold is seen arriving from above.
  private get shotBeat(): CutShot {
    const held = this.clock - this.beatAt;
    if (this.linesDue && (this.beat === 'chart' || this.beat === 'arrive')) return 'chart';   // the flat shot holds until its cut is due
    if (this.beat === 'arrive' || (this.beat === 'hold' && held < STAY_S)) return 'lines';
    return this.beat === 'hold' && this.grid && held > STAY_S + PAN_S ? 'grid' : this.beat;
  }

  // Move on to the next sky. The camera goes back to the chart first, and the
  // date changes a moment later, so the planets are seen setting off.
  next() {
    this.beat = 'chart';
    this.beatAt = this.chartAt = this.clock;
    this.linesDue = 0;
    this.changeAt = this.clock + LEAD_S;
  }

  // Follows the pendant through its loop: the chart redrawing, the gold arriving, the finished piece held.
  private follow() {
    const phase = this.traced.anim?.phase;
    if (this.changeAt && this.clock >= this.changeAt) {
      this.changeAt = 0;
      this.sky = (this.sky + 1) % HERO_SKIES.length;
      this.onChange(this.sky);
      this.engine.setBirth(HERO_SKIES[this.sky]);
      this.onSky(HERO_SKIES[this.sky]);
    }
    if (this.linesDue && this.clock >= this.linesDue) {
      // The gold may already be arriving by now; the close-up starts here either way.
      this.linesDue = 0;
      this.linesAt = this.clock;
      if (this.beat === 'chart') { this.beat = 'lines'; this.beatAt = this.clock; }
    }
    if ((this.beat === 'chart' || this.beat === 'lines') && phase === 'arrive') { this.beat = 'arrive'; this.beatAt = this.clock; }
    else if (this.beat === 'arrive' && !phase) { this.beat = 'hold'; this.beatAt = this.clock; }
    else if (this.beat === 'hold' && this.clock - this.beatAt > STAY_S + PAN_S + (this.grid ? GRID_S : 0)) this.next();
  }

  // Where the current shot wants the camera at this moment. Each shot moves steadily; the camera cuts between them (see tick).
  private goal(): Cam {
    const t = this.clock - this.beatAt, on = this.shotBeat;
    if (on === 'chart') return { ...FLAT, el: 87, dist: 900 - 14 * (this.clock - this.chartAt) };
    if (on === 'lines') { const tl = this.clock - this.linesAt; return { dist: 400 - 9 * tl, el: 58, az: 261 + 2.2 * tl, tx: 0, ty: 0 }; }
    if (on === 'grid') {
      // From above the hero's own pendant, pulling back and across until the whole grid is in view.
      const k = 1 - Math.exp(-(t - STAY_S - PAN_S) / 1.3);
      const cx = ((GRID.cols - 1) / 2 - GRID.col) * this.pitch, cy = (GRID.row - (GRID.rows - 1) / 2) * this.pitch;
      return { dist: lerp(1000, 2900, k), el: 82, az: 270, tx: cx * k, ty: cy * k };
    }
    // Low, angled and close on the finished piece, travelling slowly left to right and easing to a stop.
    const az = 300, since = 5 * (1 - Math.exp(-(t - STAY_S) / 5));
    const along = -24 + 9 * since, right = [-Math.sin(az * Math.PI / 180), Math.cos(az * Math.PI / 180)];
    return { dist: 345, el: 23, az, tx: right[0] * along, ty: right[1] * along };
  }

  private place() {
    const camera = this.viewer.camera as THREE.PerspectiveCamera, rig = this.traced.rig as THREE.Object3D, c = this.cam;
    const w = this.stage.clientWidth || 1, h = this.stage.clientHeight || 1, wide = w > h * 1.15;
    rig.updateWorldMatrix(true, false);
    // The shots are framed for a wide screen. On a tall one the camera stands further back, so the pendant fits across it as it fits down a wide one.
    const reach = wide ? 1 : Math.max(1, 0.736 / (w / h));
    const el = c.el * Math.PI / 180, az = c.az * Math.PI / 180;
    const target = new THREE.Vector3(c.tx, c.ty, 0);
    const eye = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)).multiplyScalar(c.dist * reach).add(target);
    camera.position.copy(eye.applyMatrix4(rig.matrixWorld));
    camera.up.set(0, 0, 1).transformDirection(rig.matrixWorld);
    camera.lookAt(target.applyMatrix4(rig.matrixWorld));
    camera.fov = wide ? 30 : 40;
    camera.near = 5; camera.far = 9000;
    camera.aspect = w / h;
    // Leave room for the headline: the pendant sits right of centre on a wide screen, above centre on a tall one.
    camera.setViewOffset(w, h, wide ? -0.15 * w : 0, wide ? 0 : 0.15 * h, w, h);
    camera.updateProjectionMatrix();
  }

  // Soft shapes close to the lens (CSS, see .ch-fore): they slide against the
  // camera's travel and grow as it closes in, and are out of view from above.
  private foreground() {
    const c = this.cam, az = c.az * Math.PI / 180, style = this.stage.parentElement.style;
    const travel = c.tx * -Math.sin(az) + c.ty * Math.cos(az) + 2.2 * (c.az - 270);
    style.setProperty('--fx', `${(-1.1 * travel).toFixed(1)}px`);
    style.setProperty('--fs', Math.min(2, Math.max(0.8, 520 / c.dist)).toFixed(3));
    style.setProperty('--fo', Math.min(1, Math.max(0, (82 - c.el) / 42)).toFixed(3));
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.seen || document.hidden) { this.last = 0; return; }   // out of sight: nothing is drawn and the film waits
    const gap = this.last ? now - this.last : 0, dt = Math.min(0.1, gap / 1000);
    this.last = now;
    this.clock += dt;
    this.pace(gap);
    this.follow();
    const goal = this.goal(), cut = this.cutFrom !== this.shotBeat;
    this.cutFrom = this.shotBeat;
    this.cam = cut ? goal : mix(this.cam, goal, 1 - Math.exp(-dt / 0.2));
    this.place();
    const u = this.traced.uniforms;
    u.uGoboDrift.value.set(0.011 * this.clock, 0.006 * this.clock);   // the dappled light drifts
    // The neighbours are flat pictures, convincing only from above: they are on the paper for the grid shot alone.
    u.uGridPitch.value = this.grid && this.shotBeat === 'grid' ? this.pitch : 0;
    this.foreground();
    this.chart.needsUpdate = true;   // the 2D chart may have redrawn
    this.viewer.renderOnce();
    if (!this.shown) { this.shown = true; this.onReady(); }
  };

  // Frames that keep arriving late mean this device cannot shade the canvas
  // at this sharpness: draw on fewer pixels from then on. Never back up, so
  // the picture does not pump between sharp and soft.
  private pace(gap: number) {
    // A very long gap is the tab being away or the page stalling, not a slow GPU.
    this.late = gap > LATE_FRAME_MS && gap < 250 ? this.late + 1 : 0;
    if (this.late < 4 || this.quality <= MIN_QUALITY) return;
    this.late = 0;
    this.quality = Math.max(MIN_QUALITY, this.quality * 0.85);
    this.viewer.setQuality(this.quality);
  }

  // The window's shadow across the paper (see uBar in glsl.js).
  private setShadow(s: Shadow) {
    const u = this.traced.uniforms;
    u.uBar.value.set((s.angle + 90) * Math.PI / 180, s.offset - s.width / 2, s.width, 1 - s.depth);
    u.uBarSoft.value = s.soft;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.watch.disconnect();
    this.viewer.setQuality(1);
    this.traced.setGrid(null, 0);
    this.grid?.dispose();
    this.canvas2d.removeEventListener('aspects-updated', this.onLines);
    this.traced.setChart(null, 1);
    this.chart.dispose();
  }
}
