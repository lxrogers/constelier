// Imperative stage for the big-three ring prototype: one Three.js scene (the
// gold ring, lying on the table) between two 2D canvases (the zodiac wheel
// under it, the labels over it). Everything is drawn through the same camera,
// so the wheel and labels stay glued to the ring while the view tilts.
//
// Nothing fades: the sun and moon are meshes that turn about the ring's axis,
// and "flat" and "tilted" are the same scene seen from two angles.

import * as THREE from 'three';
import { PendantViewer } from '@/modules/three-pendant-viewer';
import { easeInOutCubic } from '@/modules/easing';
import {
  SIGN_NAMES, RING, RING_OUTER_R,
  lerpAngle, layoutOffsets, offsetToAngle, formatPosition, formatHouse,
  markerProfile, ringHalfHeight, bandFollowsSun, buildBandMesh, buildMarkerMesh,
} from '@/modules/prototypes/big3-ring';
import type { Big3, RingDesign, ViewMode } from './types';

export interface RingStageElements {
  wrap: HTMLElement;
  wheel: HTMLCanvasElement;
  gl: HTMLCanvasElement;
  labels: HTMLCanvasElement;
}

export interface RingStageView {
  mode: ViewMode;
  showWheel: boolean;
  showLabels: boolean;
}

export interface RingStage {
  setChart(big3: Big3): void;
  setDesign(design: RingDesign): void;
  setView(view: RingStageView): void;
  replay(): void;
  /** Where the camera is now, in the terms of the tilt sliders. */
  getView(): { tiltDeg: number; tiltDir: number };
  /** Back to the view the current mode would show. */
  resetView(): void;
  destroy(): void;
}

// Virtual stage, in px. The canvases scale to whatever size the wrapper is.
const VW = 1000, VH = 700;
const K = 8;                      // world units per mm (keeps the pendant's lighting rig in scale)
const PX_PER_MM = 15.0;           // flat view
const CAM_DIST = 2400;
const ICON_R = 12.5, WHEEL_IN = 15.0, WHEEL_OUT = 17.8, LABEL_R = 18.6; // mm from the ring's centre

const MOVE_MS = 950;
const UNTILT_MS = 450;
const TILT_MS = 1200;
const TILT_ZOOM = 0.22;
const FOCUS_MS = 900;
const FOCUS_ZOOM = 2.6;            // looking straight at one marker
const SETTLE_MS = 350;            // pause between the bodies landing and the tilt

const INK = '#2c2c2c', MUTED = '#7a7568', LINE = '#a89f92', PAPER = '#f5f0e6';
const FONT = "'Graphik Web', system-ui, sans-serif";

interface Pose { asc: number; sun: number; moon: number; sunOff: number; moonOff: number; }

export async function createRingStage(els: RingStageElements, initialDesign: RingDesign, initialView: RingStageView): Promise<RingStage> {
  let destroyed = false;
  let design = initialDesign;
  let view = initialView;
  let big3: Big3 | null = null;

  // ── 3D scene ───────────────────────────────────────────────

  const viewer = new PendantViewer(els.gl, {
    enableControls: false,
    enableEdges: false,
    enableGroundPlane: false,
    enableHDRI: true,
    hdriPath: '/softbox-2k.hdr',
    enablePostProcessing: true,
    background: null,
    roughness: 0,
  });
  viewer.scene.background = null;
  if (viewer.scene.environmentRotation !== undefined) {
    viewer.scene.environmentRotation.set(344 * Math.PI / 180, 308 * Math.PI / 180, 0);
  }
  viewer.fitToRegionExact(VH / 2 / PX_PER_MM * K, 0); // also rebuilds the composer for this camera
  viewer.addShadowPlane(-0.5);
  viewer.pendantGroup.scale.setScalar(K);

  const taaPass = viewer.composer?.passes.find((pass: any) => 'sampleLevel' in pass) as { sampleLevel: number } | undefined;

  const camera: THREE.PerspectiveCamera = viewer.camera;
  camera.fov = 2 * Math.atan((VH / 2 / PX_PER_MM * K) / CAM_DIST) * 180 / Math.PI;
  camera.aspect = VW / VH;
  camera.near = 10;
  camera.far = CAM_DIST * 2;

  type PartName = 'band' | 'asc' | 'sun' | 'moon';
  const parts: Record<PartName, THREE.Mesh | null> = { band: null, asc: null, sun: null, moon: null };
  type Profile = { outer: number[][]; holes: number[][][]; halfU: number } | null;
  const profiles: Record<'asc' | 'sun' | 'moon', Profile> = { asc: null, sun: null, moon: null };
  let halfHeight = 1;        // mm, the ring's reach either side of the band's centre line
  let bandRebuilds = false;  // the band's mesh depends on where the sun is (gap + a sun with a hole)
  let bandBuiltAt = NaN;
  let builtKey = '';

  function setPart(name: PartName, meshData: any) {
    const old = parts[name];
    if (old) { viewer.pendantGroup.remove(old); old.geometry.dispose(); }
    parts[name] = null;
    if (!meshData) return;
    const mesh: THREE.Mesh = viewer.createMesh(meshData);
    viewer.pendantGroup.add(mesh);
    parts[name] = mesh;
  }

  function rebuildMeshes() {
    const key = [design.asc, design.sun, design.moon, design.width, design.size, design.relief].join('|');
    if (key === builtKey) return;
    builtKey = key;
    bandRebuilds = bandFollowsSun(design);
    bandBuiltAt = NaN;
    if (!bandRebuilds) setPart('band', buildBandMesh(design, 180));
    for (const kind of ['asc', 'sun', 'moon'] as const) {
      setPart(kind, buildMarkerMesh(kind, design));
      profiles[kind] = markerProfile(kind, design[kind], design.size, design.width);
    }
    halfHeight = ringHalfHeight(design);
    // the ring's axis is vertical: lift it so its widest shape rests on the table
    viewer.pendantGroup.position.y = K * halfHeight;
  }

  // Markers are built on the right-hand side (180 degrees past the ascendant):
  // turn each about the axis to where it belongs.
  const turnTo = (offDeg: number) => offsetToAngle(offDeg);

  function placeParts(p: Pose) {
    if (parts.asc) parts.asc.rotation.z = turnTo(0);
    if (parts.sun) parts.sun.rotation.z = turnTo(p.sunOff);
    if (parts.moon) parts.moon.rotation.z = turnTo(p.moonOff);
    if (bandRebuilds) {
      if (p.sunOff !== bandBuiltAt) {
        setPart('band', buildBandMesh(design, p.sunOff));
        bandBuiltAt = p.sunOff;
      }
    } else if (parts.band) {
      // without a gap the band is the same all the way round, so its sun just turns with it
      parts.band.rotation.z = design.asc === 'gap' ? 0 : turnTo(p.sunOff);
    }
  }

  // ── Animation state ────────────────────────────────────────

  let pose: Pose | null = null;           // what is on screen
  let move: { from: Pose; to: Pose; start: number } | null = null;
  // The view is the straight-down camera turned by `camQ` about the ring's
  // centre: identity is the flat, chart-like view. `zoom` multiplies it.
  type View = { q: THREE.Quaternion; zoom: number };
  const UP = new THREE.Vector3(0, 1, 0);
  const flatView = (): View => ({ q: new THREE.Quaternion(), zoom: 1 });
  // Tip the view over by tiltDeg, the camera heading toward tiltDir on the
  // table: 0 is toward the bottom of the screen, 90 toward the left.
  function tiltView(): View {
    const t = design.tiltDeg * Math.PI / 180, d = design.tiltDir * Math.PI / 180;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(d), 0, Math.sin(d)), t);
    // tipped toward the bottom or top, the ring takes less height: come in closer
    return { q, zoom: 1 + TILT_ZOOM * Math.min(1, (1 - Math.cos(t)) / 0.5) * Math.cos(d) ** 2 };
  }
  let wantTilt = view.mode === 'always-3d';
  const camQ = (wantTilt ? tiltView() : flatView()).q;
  let zoom = wantTilt ? tiltView().zoom : 1;
  let viewAnim: { from: View; to: View; start: number; dur: number } | null = null;
  let dragging = false;
  let focused: 'asc' | 'sun' | 'moon' | null = null; // the marker the view is turned to face
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let rafId: number | null = null;

  const camDir = new THREE.Vector3();
  // How far the camera has come down from straight above, in degrees.
  function tiltFromTop() {
    camDir.copy(UP).applyQuaternion(camQ);
    return Math.acos(Math.max(-1, Math.min(1, camDir.y))) * 180 / Math.PI;
  }

  function targetPose(b: Big3): Pose {
    const off = layoutOffsets(b);
    return { asc: b.asc.deg, sun: b.sun.deg, moon: b.moon.deg, sunOff: off.sun, moonOff: off.moon };
  }

  function lerpPose(a: Pose, b: Pose, t: number): Pose {
    return {
      asc: lerpAngle(a.asc, b.asc, t),
      sun: lerpAngle(a.sun, b.sun, t),
      moon: lerpAngle(a.moon, b.moon, t),
      sunOff: lerpAngle(a.sunOff, b.sunOff, t),
      moonOff: lerpAngle(a.moonOff, b.moonOff, t),
    };
  }

  function aimView(to: View, dur: number) {
    viewAnim = { from: { q: camQ.clone(), zoom }, to, start: performance.now(), dur };
    requestFrame();
  }

  function aimTilt(dur: number) {
    focused = null;
    aimView(wantTilt ? tiltView() : flatView(), dur);
  }

  // Turn the view to look straight at one marker, close up, shapes upright.
  function focusOn(kind: 'asc' | 'sun' | 'moon') {
    if (!pose) return;
    clearSettle();
    const a = kind === 'asc' ? Math.PI : offsetToAngle(kind === 'sun' ? pose.sunOff : pose.moonOff);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));       // from the ring's centre through the marker
    const right = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, out, new THREE.Vector3(0, -1, 0)));
    focused = kind;
    aimView({ q, zoom: FOCUS_ZOOM }, FOCUS_MS);
  }

  function clearSettle() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  }

  // Flat-first: once the bodies have landed, wait a beat and tilt.
  function scheduleSettle(delay: number) {
    clearSettle();
    if (view.mode !== 'flat-first') return;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      wantTilt = true;
      aimTilt(TILT_MS);
    }, delay);
  }

  function startMove(from: Pose, to: Pose) {
    clearSettle();
    let delay = 0;
    if (view.mode === 'flat-first') {
      // lie the ring flat again first, so the move reads as the 2D chart
      const wasTilted = tiltFromTop() > 1;
      wantTilt = false;
      aimTilt(UNTILT_MS);
      if (wasTilted) delay = UNTILT_MS * 0.6;
    }
    if (view.mode === 'always-3d' && focused) {
      // the body is about to leave the close-up: pull back to the whole ring
      wantTilt = true;
      aimTilt(FOCUS_MS);
    }
    move = { from, to, start: performance.now() + delay };
    requestFrame();
  }

  // ── Projection ─────────────────────────────────────────────

  const v = new THREE.Vector3();
  // A point on the ring's plane (mm, chart angles) at world height y -> stage px
  function project(xmm: number, ymm: number, y: number): [number, number] {
    v.set(xmm * K, y, ymm * K).project(camera);
    return [(v.x * 0.5 + 0.5) * VW, (-v.y * 0.5 + 0.5) * VH];
  }
  const polar = (r: number, a: number, y = 0) => project(r * Math.cos(a), r * Math.sin(a), y);

  const camUp = new THREE.Vector3();
  function placeCamera() {
    const midY = K * halfHeight;
    camDir.copy(UP).applyQuaternion(camQ);
    camera.position.set(camDir.x * CAM_DIST, midY + camDir.y * CAM_DIST, camDir.z * CAM_DIST);
    // straight down, screen-up is "away" on the table; it turns with the view from there
    camera.up.copy(camUp.set(0, 0, -1).applyQuaternion(camQ));
    camera.lookAt(0, midY, 0);
    camera.zoom = zoom;
    // seen from above, the shadow lands well clear of the ring and muddies the chart: keep it faint until tilted
    viewer.setShadowOpacity(0.07 + 0.12 * Math.min(1, tiltFromTop() / 50));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  // ── Orbit ──────────────────────────────────────────────────
  // Drag to turn the view about the ring, wheel to zoom. Free tumbling, so
  // any angle can be reached; the next move or "reset" takes the view back.

  let lastX = 0, lastY = 0;
  const axis = new THREE.Vector3(), turn = new THREE.Quaternion();
  function onPointerDown(e: PointerEvent) {
    dragging = true;
    focused = null;
    lastX = e.clientX; lastY = e.clientY;
    viewAnim = null;
    clearSettle();
    els.wrap.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    camQ.premultiply(turn.setFromAxisAngle(axis.set(1, 0, 0).applyQuaternion(camQ), -dy * 0.008));
    camQ.premultiply(turn.setFromAxisAngle(axis.set(0, 0, -1).applyQuaternion(camQ), -dx * 0.008));
    camQ.normalize();
    requestFrame();
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try { els.wrap.releasePointerCapture(e.pointerId); } catch {}
    requestFrame(); // one more frame at full quality
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    viewAnim = null;
    clearSettle();
    zoom = Math.max(0.6, Math.min(6, zoom * Math.exp(-e.deltaY * 0.0012)));
    requestFrame();
  }
  els.wrap.addEventListener('pointerdown', onPointerDown);
  els.wrap.addEventListener('pointermove', onPointerMove);
  els.wrap.addEventListener('pointerup', onPointerUp);
  els.wrap.addEventListener('pointercancel', onPointerUp);
  els.wrap.addEventListener('wheel', onWheel, { passive: false });

  // ── 2D layers ──────────────────────────────────────────────

  const wheelCtx = els.wheel.getContext('2d')!;
  const labelCtx = els.labels.getContext('2d')!;
  let pxScale = 1; // backing-store px per stage px

  function ringPath(ctx: CanvasRenderingContext2D, r: number) {
    const n = 144;
    for (let i = 0; i <= n; i++) {
      const [x, y] = polar(r, (i / n) * 2 * Math.PI);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Text lying on the table: each glyph gets the local affine map of the
  // projection at its spot, so it foreshortens with the wheel.
  function drawGlyphOnTable(ctx: CanvasRenderingContext2D, ch: string, r: number, a: number, flip: boolean) {
    const px = Math.cos(a), py = Math.sin(a);
    // glyph x axis along the arc, glyph y axis ("down") toward the centre; reversed on the lower half
    const s = flip ? -1 : 1;
    const ex = [-py * s, px * s], ey = [-px * s, -py * s];
    const e = 0.05, P: [number, number] = [r * px, r * py];
    const p0 = project(P[0], P[1], 0);
    const p1 = project(P[0] + ex[0] * e, P[1] + ex[1] * e, 0);
    const p2 = project(P[0] + ey[0] * e, P[1] + ey[1] * e, 0);
    const k = pxScale / (e * PX_PER_MM);
    ctx.setTransform((p1[0] - p0[0]) * k, (p1[1] - p0[1]) * k, (p2[0] - p0[0]) * k, (p2[1] - p0[1]) * k, p0[0] * pxScale, p0[1] * pxScale);
    ctx.fillText(ch, 0, 0);
  }

  function drawWheel(p: Pose) {
    const ctx = wheelCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.wheel.width, els.wheel.height);
    // seen edge-on the wheel is only a smear: let it go as the view comes level with the table
    const level = Math.max(0, Math.min(1, (88 - tiltFromTop()) / 12));
    if (!view.showWheel || level <= 0) return;
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.globalAlpha = level;

    const eclAngle = (ecl: number) => (180 - ecl + p.asc) * Math.PI / 180;

    ctx.beginPath();
    ringPath(ctx, WHEEL_OUT);
    ringPath(ctx, WHEEL_IN);
    ctx.fillStyle = PAPER;
    ctx.fill('evenodd');

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ringPath(ctx, WHEEL_OUT); ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ringPath(ctx, WHEEL_IN); ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = eclAngle(i * 30);
      const [x1, y1] = polar(WHEEL_IN, a), [x2, y2] = polar(WHEEL_OUT, a);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // where the sun and moon truly are, when the shapes had to be nudged apart
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const ecl of [p.sun, p.moon]) {
      const a = eclAngle(ecl);
      const [x1, y1] = polar(WHEEL_IN - 0.55, a), [x2, y2] = polar(WHEEL_IN + 0.1, a);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    ctx.font = `12.5px ${FONT}`;
    ctx.fillStyle = '#8a8078';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textR = (WHEEL_IN + WHEEL_OUT) / 2;
    const arcPx = textR * PX_PER_MM;
    for (let i = 0; i < 12; i++) {
      const label = SIGN_NAMES[i].toUpperCase();
      const widths = [...label].map(ch => ctx.measureText(ch).width + 1.2);
      const total = widths.reduce((s, w) => s + w, 0) / arcPx;
      const mid = eclAngle(i * 30 + 15);
      const norm = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const lower = norm > 0.05 && norm < Math.PI - 0.05;
      let a = lower ? mid + total / 2 : mid - total / 2;
      for (let c = 0; c < label.length; c++) {
        const step = widths[c] / arcPx * (lower ? -1 : 1);
        a += step / 2;
        drawGlyphOnTable(ctx, label[c], textR, a, lower);
        a += step / 2;
      }
    }
  }

  function drawLabels(p: Pose) {
    const ctx = labelCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.labels.width, els.labels.height);
    if (!view.showLabels || !big3) return;
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);

    // Looking straight at one marker: just its own caption, above it.
    if (focused) {
      const who = focused === 'asc' ? big3.asc : focused === 'sun' ? big3.sun : big3.moon;
      const lines: Array<[string, string, string]> = [
        [focused === 'asc' ? 'ASCENDANT' : focused.toUpperCase(), `500 11px ${FONT}`, MUTED],
        [formatPosition(who), `22px 'Moulin', serif`, INK],
        [focused === 'asc' ? 'rising' : formatHouse(who), `12px ${FONT}`, MUTED],
      ];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let y = 70;
      for (const [text, font, color] of lines) {
        ctx.font = font; ctx.fillStyle = color;
        ctx.fillText(text, VW / 2, y);
        y += 24;
      }
      return;
    }
    // The leaders only make sense from above: let them go as the view comes level with the table.
    const level = Math.max(0, Math.min(1, (80 - tiltFromTop()) / 12));
    if (level <= 0) return;
    ctx.globalAlpha = level;

    const topY = 2 * K * halfHeight;
    const centre = project(0, 0, topY / 2);
    // far side: level with the ring's upper edge, so things clear it; near side: down on the table
    const lift = (a: number) => topY * (1 - Math.sin(a)) / 2;
    const items = [
      { kind: 'asc' as const, name: 'Ascendant', a: Math.PI, where: formatPosition(big3.asc), extra: 'rising' },
      { kind: 'sun' as const, name: 'Sun', a: offsetToAngle(p.sunOff), where: formatPosition(big3.sun), extra: formatHouse(big3.sun) },
      { kind: 'moon' as const, name: 'Moon', a: offsetToAngle(p.moonOff), where: formatPosition(big3.moon), extra: formatHouse(big3.moon) },
    ];

    // Side-on the shapes are hidden in the band's thickness (they only widen
    // it), so mark where each one starts and ends. Gone once the ring tilts.
    const flat = Math.max(0, 1 - tiltFromTop() / 18);
    if (flat > 0) {
      ctx.globalAlpha = flat * level;
      ctx.strokeStyle = '#4a3a12';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const it of items) {
        const prof = profiles[it.kind];
        if (!prof) continue;
        for (const side of [-1, 1]) {
          const a = it.a + side * prof.halfU / RING_OUTER_R;
          const [x1, y1] = polar(RING.innerR, a, topY), [x2, y2] = polar(RING_OUTER_R, a, topY);
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = level;
    }

    // a small drawing of each shape beside its place on the band, face-on
    for (const it of items) {
      const prof = profiles[it.kind];
      const [ix, iy] = polar(ICON_R, it.a, lift(it.a));
      ctx.fillStyle = '#5a524a';
      ctx.beginPath();
      if (prof) {
        const k = 3.4; // px per mm
        // drawn as the shape sits on the left of the chart, where "along the band" is up the screen
        const upright = it.kind === 'asc';
        for (const ring of [prof.outer, ...prof.holes]) {
          ring.forEach((q, i) => {
            const x = ix + (upright ? q[1] : q[0]) * k, y = iy + (upright ? q[0] : q[1]) * k;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          });
          ctx.closePath();
        }
        ctx.fill('evenodd');
      } else {
        // the gap: two band ends
        ctx.rect(ix - 7, iy - 3.5, 4.5, 7); ctx.rect(ix + 2.5, iy - 3.5, 4.5, 7);
        ctx.fill();
      }
    }

    // lay the blocks out first, so neighbours can be eased apart
    const blocks = items.map(it => {
      const from = polar(ICON_R + 1.15, it.a, lift(it.a));
      const to = polar(LABEL_R, it.a, lift(it.a));
      let dx = to[0] - centre[0], dy = to[1] - centre[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const align: CanvasTextAlign = dx > 0.3 ? 'left' : dx < -0.3 ? 'right' : 'center';
      const lines = [
        { text: it.name.toUpperCase(), font: `500 10.5px ${FONT}`, color: MUTED, h: 14, spacing: '0.9px' },
        { text: it.where, font: `17px 'Moulin', serif`, color: INK, h: 20, spacing: '0px' },
        { text: it.extra, font: `11.5px ${FONT}`, color: MUTED, h: 15, spacing: '0px' },
      ].filter(l => l.text);
      let w = 0;
      for (const l of lines) { ctx.font = l.font; w = Math.max(w, ctx.measureText(l.text).width); }
      const h = lines.reduce((s, l) => s + l.h, 0);
      const x = to[0] + dx * 9;
      // the block sits beyond the end of the leader: above it at the top, below at the bottom
      const y = to[1] + dy * 9 - h * (0.5 - dy * 0.5);
      return { from, lines, align, x, y, w, h, left: 0, toY: to[1] };
    });

    const fit = () => {
      for (const bl of blocks) {
        const lo = bl.align === 'left' ? 4 : bl.align === 'right' ? bl.w + 4 : bl.w / 2 + 4;
        const hi = bl.align === 'left' ? VW - bl.w - 4 : bl.align === 'right' ? VW - 4 : VW - bl.w / 2 - 4;
        bl.x = Math.max(lo, Math.min(hi, bl.x));
        bl.y = Math.max(4, Math.min(VH - bl.h - 4, bl.y));
        bl.left = bl.align === 'left' ? bl.x : bl.align === 'right' ? bl.x - bl.w : bl.x - bl.w / 2;
      }
    };
    fit();
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
        const A = blocks[i], B = blocks[j], pad = 6;
        if (A.left + A.w + pad < B.left || B.left + B.w + pad < A.left) continue;
        const [up, down] = A.y <= B.y ? [A, B] : [B, A];
        const overlap = up.y + up.h + pad - down.y;
        if (overlap <= 0) continue;
        up.y -= overlap / 2;
        down.y += overlap / 2;
      }
      fit();
    }

    for (const bl of blocks) {
      const endX = bl.align === 'left' ? bl.x - 6 : bl.align === 'right' ? bl.x + 6 : bl.x;
      const endY = bl.align === 'center' ? (bl.toY > bl.y + bl.h / 2 ? bl.y + bl.h + 3 : bl.y - 3) : bl.y + bl.h / 2;
      ctx.strokeStyle = '#5a524a';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(bl.from[0], bl.from[1]); ctx.lineTo(endX, endY); ctx.stroke();

      let y = bl.y;
      ctx.textAlign = bl.align;
      ctx.textBaseline = 'middle';
      for (const l of bl.lines) {
        ctx.font = l.font;
        ctx.fillStyle = l.color;
        (ctx as any).letterSpacing = l.spacing;
        ctx.fillText(l.text, bl.x, y + l.h / 2);
        y += l.h;
      }
      (ctx as any).letterSpacing = '0px';
    }
    ctx.globalAlpha = 1;
  }

  // ── Frame loop ─────────────────────────────────────────────

  function requestFrame() {
    if (rafId == null && !destroyed) rafId = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    rafId = null;
    if (destroyed) return;

    if (move) {
      const t = Math.max(0, Math.min(1, (now - move.start) / MOVE_MS));
      pose = lerpPose(move.from, move.to, easeInOutCubic(t));
      if (t >= 1) {
        pose = move.to;
        move = null;
        scheduleSettle(SETTLE_MS);
      }
    }
    if (viewAnim) {
      const t = Math.max(0, Math.min(1, (now - viewAnim.start) / viewAnim.dur)), e = easeInOutCubic(t);
      camQ.slerpQuaternions(viewAnim.from.q, viewAnim.to.q, e);
      zoom = viewAnim.from.zoom + (viewAnim.to.zoom - viewAnim.from.zoom) * e;
      if (t >= 1) viewAnim = null;
    }

    if (pose) {
      placeParts(pose);
      placeCamera();
      // fewer anti-aliasing samples while things move, full quality for the frame that stays
      if (taaPass) taaPass.sampleLevel = move || viewAnim || dragging ? 1 : 3;
      viewer.renderOnce();
      drawWheel(pose);
      drawLabels(pose);
    }

    if (move || viewAnim) rafId = requestAnimationFrame(frame);
  }

  // ── Sizing ─────────────────────────────────────────────────

  function resize() {
    const w = els.wrap.clientWidth;
    if (!w) return;
    const h = w * VH / VW;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pxScale = (w / VW) * dpr;
    for (const c of [els.wheel, els.labels]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    viewer.renderer.setPixelRatio(dpr);
    viewer.renderer.setSize(w, h, false);
    if (viewer.composer) {
      viewer.composer.setPixelRatio(dpr);
      viewer.composer.setSize(w, h);
    }
    requestFrame();
  }

  els.gl.style.width = '';
  els.gl.style.height = '';
  const observer = new ResizeObserver(resize);
  observer.observe(els.wrap);

  rebuildMeshes();
  resize();

  if (viewer.hdriReady) await viewer.hdriReady.catch(() => {});
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  if (!destroyed) {
    els.gl.style.opacity = '1';
    requestFrame();
  }

  // ── API ────────────────────────────────────────────────────

  return {
    setChart(next) {
      big3 = next;
      const to = targetPose(next);
      if (!pose) {
        pose = to;
        requestFrame();
        scheduleSettle(900);
        return;
      }
      startMove({ ...pose }, to);
    },

    setDesign(next) {
      const tiltChanged = next.tiltDeg !== design.tiltDeg || next.tiltDir !== design.tiltDir;
      const restyled = (['asc', 'sun', 'moon'] as const).find(kind => next[kind] !== design[kind]);
      design = next;
      rebuildMeshes();
      if (restyled) {
        focusOn(restyled); // show the new shape face-on
      } else if (tiltChanged && wantTilt) {
        // follow the sliders directly
        viewAnim = null;
        const to = tiltView();
        camQ.copy(to.q);
        zoom = to.zoom;
      }
      requestFrame();
    },

    setView(next) {
      const modeChanged = next.mode !== view.mode;
      view = next;
      if (modeChanged) {
        clearSettle();
        if (view.mode === 'always-3d') {
          wantTilt = true;
          aimTilt(TILT_MS);
        } else {
          // show the whole flat-first beat: lie flat, pause, tilt
          wantTilt = false;
          aimTilt(UNTILT_MS);
          scheduleSettle(UNTILT_MS + 900);
        }
      }
      requestFrame();
    },

    // Sweep the sun and moon out from either side of the ascendant again.
    replay() {
      if (!big3) return;
      const to = targetPose(big3);
      startMove({ ...to, sunOff: 17, moonOff: -17 }, to);
    },

    getView() {
      camDir.copy(UP).applyQuaternion(camQ);
      const dir = Math.atan2(-camDir.x, camDir.z) * 180 / Math.PI;
      return { tiltDeg: Math.round(tiltFromTop()), tiltDir: Math.round((dir + 360) % 360) };
    },

    resetView() {
      clearSettle();
      wantTilt = true;
      aimTilt(FOCUS_MS);
    },

    destroy() {
      destroyed = true;
      els.wrap.removeEventListener('pointerdown', onPointerDown);
      els.wrap.removeEventListener('pointermove', onPointerMove);
      els.wrap.removeEventListener('pointerup', onPointerUp);
      els.wrap.removeEventListener('pointercancel', onPointerUp);
      els.wrap.removeEventListener('wheel', onWheel);
      clearSettle();
      if (rafId != null) cancelAnimationFrame(rafId);
      observer.disconnect();
      for (const name of Object.keys(parts) as PartName[]) setPart(name, null);
      try { viewer.dispose(); } catch {}
    },
  };
}
