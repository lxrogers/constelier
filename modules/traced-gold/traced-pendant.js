// A pendant drawn with the traced gold shaders (./glsl.js), and the short
// animations that take its inside away and bring a new one in.
//
// Add `object` to whatever holds the pendant's mesh (its parent's space is the
// mesh's own space) and call `update(camera)` before every render. With
// `requestRender` it drives its own frames while something is moving, for
// viewers that only render on demand.
import * as THREE from 'three';
import { GOLD_FRAG, PLANE_FRAG, REVEAL_FRAG, VERT } from './glsl.js';
import { buildPendantSdf } from './pendant-sdf.js';

// How the metal arrives: 'fade' and 'glint' fade the finished mesh; the rest
// reshape the metal and are drawn by marching the distance map.
const MARCHED = { outline: 1, rise: 2, liquid: 3, pour: 4, flow: 5 };
const LEAD_MS = 350, HOLD_MS = 1100;   // pauses when a round repeats (the lab)
const SDF_SIZE = 1024;

// A CSS-style cubic-bezier timing curve: [x1, y1, x2, y2].
export const DEFAULT_CURVE = [0.25, 0.8, 0.39, 0.99];
// One round: the inside drains out, then the new one flows in from the rim.
export const DEFAULT_PLAY = { kind: 'flow', ms: 1400, keepRim: true, exit: 'drain', exitMs: 300, loop: false };

// Lighting set-ups, in rig space (pendant flat in XY, seen from +z).
export const LOOKS = {
  // Lying on speckled stone in dappled sun.
  stone: {
    surface: 0, sunDir: [-0.5, 0.42, 0.76], sunColor: [1.05, 0.96, 0.82], sunK: 24, ambient: [0.3, 0.31, 0.34], gobo: 0.7, ao: 0.6, gap: 0, up: [0, 0, 1],
    card: { dir: [-0.06, 0.74, 0.67], dist: 420, half: [280, 240], roll: 0.5, gain: 1.08, lo: 0.5 },
  },
  // Hanging just off a plaster wall in raking sun.
  wall: {
    surface: 1, sunDir: [-0.6, 0.62, 0.5], sunColor: [0.92, 0.86, 0.76], sunK: 12.7, ambient: [0.62, 0.63, 0.66], gobo: 0, ao: 0.25, gap: 9, up: [0, 1, 0],
    card: { dir: [-0.22, 0.1, 0.97], dist: 430, half: [300, 300], roll: 0.6, gain: 1.05, lo: 0.5 },
  },
  // Floating over the page behind the canvas: no surface of its own, only a
  // shadow. The wall's light, with the sun higher and softer so the shadow
  // stays close under the metal instead of reaching across the chart.
  page: {
    surface: 2, sunDir: [-0.38, 0.42, 0.82], sunColor: [0.92, 0.86, 0.76], sunK: 9, ambient: [0.62, 0.63, 0.66], gobo: 0, ao: 0.25, gap: 2, up: [0, 1, 0],
    card: { dir: [-0.22, 0.1, 0.97], dist: 430, half: [300, 300], roll: 0.6, gain: 1.05, lo: 0.5 },
  },
};

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const back = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);   // overshoots a little, then settles
function bezier([x1, y1, x2, y2], x) {
  const at = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
  return at(y1, y2, (lo + hi) / 2);
}

// ── Distance maps, built in a worker when there is one ─────────────────────
let worker = null, workerBroken = false, jobSeq = 0;
const jobs = new Map();

function sdfWorker() {
  if (worker || workerBroken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./sdf.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const job = jobs.get(e.data.id);
      if (!job) return;
      jobs.delete(e.data.id);
      if (e.data.error) { console.warn('[sdf worker]', e.data.error); job.resolve(job.local()); } else job.resolve(e.data);
    };
    worker.onerror = (e) => {
      console.warn('[sdf worker] failed, building on the main thread', e?.message || e);
      workerBroken = true;
      try { worker.terminate(); } catch {}
      worker = null;
      for (const job of jobs.values()) job.resolve(job.local());
      jobs.clear();
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

function requestSdf(vertices, triangles, extent) {
  const local = () => buildPendantSdf(vertices, triangles, extent, SDF_SIZE);
  return new Promise((resolve) => {
    const w = sdfWorker();
    if (!w) { resolve(local()); return; }
    const id = ++jobSeq;
    jobs.set(id, { resolve, local });
    w.postMessage({ id, vertices, triangles, extent, size: SDF_SIZE });
  });
}

export class TracedPendant {
  constructor({ requestRender = null } = {}) {
    this.requestRender = requestRender;
    this.object = new THREE.Group();
    this.object.visible = false;                 // nothing to show until the first distance map exists
    // Rig space: the mesh turned over (its z = 0 face toward +z) and centred on its thickness.
    this.rig = new THREE.Group();
    this.rig.rotation.x = Math.PI;
    this.object.add(this.rig);

    this.uniforms = {
      uRigInv: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
      uSdf: { value: null }, uExtent: { value: 130 }, uHalf: { value: 6 }, uRound: { value: 2 }, uPlaneZ: { value: -6 },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Vector3() }, uAmbient: { value: new THREE.Vector3() },
      uGold: { value: new THREE.Vector3(1.0, 0.74, 0.33) },   // the Blender scenes' gold, linear
      uSunK: { value: 20 }, uSunDisc: { value: Math.cos(0.05) },
      uEnv: { value: null }, uEnvRot: { value: new THREE.Matrix3() }, uEnvGain: { value: 0.32 }, uRough: { value: 0.04 }, uExposure: { value: 1 },
      uCardPos: { value: new THREE.Vector3() }, uCardU: { value: new THREE.Vector3() }, uCardV: { value: new THREE.Vector3() },
      uCardColor: { value: new THREE.Vector3(1, 0.97, 0.92) }, uCardHalf: { value: new THREE.Vector2() }, uCardGain: { value: 2 }, uCardLo: { value: 0.3 },
      uTrace: { value: 1 }, uShadows: { value: 1 }, uSurface: { value: 0 }, uGobo: { value: 0 }, uAo: { value: 0.6 },
      uMode: { value: 0 }, uP: { value: 1 }, uRise: { value: 1 }, uDome: { value: 2 }, uDrop: { value: 2 }, uOutR: { value: 2 }, uOutZ: { value: 2 }, uTop: { value: 6 },
      uAlpha: { value: 1 }, uShadowGain: { value: 1 }, uGlint: { value: 1e5 }, uKeepRim: { value: 0 }, uRimR: { value: 100 }, uSplit: { value: 105 },
    };
    const material = (fragmentShader, extra) => new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader, transparent: true, ...extra });
    this.goldMat = material(GOLD_FRAG);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), material(PLANE_FRAG, { depthWrite: false }));
    this.plane.renderOrder = -1;
    // The metal mid-change is drawn on a box around the pendant's slab (see REVEAL_FRAG).
    this.box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), material(REVEAL_FRAG, { depthTest: false, depthWrite: false }));
    this.box.renderOrder = 2;
    this.box.visible = false;
    this.rig.add(this.plane, this.box);

    this.mesh = null;
    this.half = 6;
    this.ready = false;        // a distance map is in place
    this.curve = [...DEFAULT_CURVE];
    this.look = LOOKS.wall;
    this.toggles = { trace: true, shadows: true, card: true };
    this.envTilt = [0, 0];
    this.anim = null;          // { phase: 'exit' | 'rim' | 'arrive' | 'hold' | 'posed', start, play, then }
    this.gen = 0;              // which request the latest distance map belongs to
    this.sdfMs = 0;
    this.triangles = 0;
    this.raf = 0;
    this.building = null;      // the distance map being built, if any
    this.onArrived = null;     // called each time an arrival finishes
    this.onArriving = null;    // called once, when the next reveal() starts to arrive
    this.applyLook();
  }

  // ── Look ────────────────────────────────────────────────────────────────

  setLook(look) { this.look = look; this.applyLook(); }
  setToggles(toggles) { this.toggles = { ...this.toggles, ...toggles }; this.applyLook(); }
  setCurve(curve) { this.curve = [...curve]; }
  setRoughness(v) { this.uniforms.uRough.value = Math.max(0.04, v); }   // a true mirror shows every texel of the environment
  // An sRGB colour (CSS string or hex) for the metal.
  setGold(color) { const c = new THREE.Color(color); this.uniforms.uGold.value.set(c.r, c.g, c.b); }
  // Turn the environment's reflections about x and y, in degrees.
  setEnvRotation(rx, ry) { this.envTilt = [rx, ry]; this.applyLook(); }

  // An equirectangular HDR. It is sampled directly, blurrier mips for rougher metal.
  setEnvironment(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.uniforms.uEnv.value = texture;
  }

  applyLook() {
    const s = this.look, u = this.uniforms, t = this.toggles;
    u.uSunDir.value.copy(v3(s.sunDir).normalize());
    u.uSunColor.value.copy(v3(s.sunColor));
    u.uAmbient.value.copy(v3(s.ambient));
    u.uSunK.value = s.sunK;
    u.uSurface.value = s.surface;
    u.uGobo.value = s.gobo;
    u.uAo.value = s.ao;
    u.uPlaneZ.value = this.plane.position.z = -this.half - s.gap;
    // Equirect maps treat +y as up; where the pendant lies flat, up is +z.
    const base = new THREE.Matrix4();
    if (s.up[2]) base.set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
    const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(this.envTilt[0] * Math.PI / 180, this.envTilt[1] * Math.PI / 180, 0));
    u.uEnvRot.value.setFromMatrix4(base.multiply(tilt));
    // The card faces the pendant from `dir`; its gradient runs along its own u axis.
    const dir = v3(s.card.dir).normalize(), up = v3(s.up);
    const cu = new THREE.Vector3().crossVectors(up, dir).normalize(), cv = new THREE.Vector3().crossVectors(dir, cu);
    u.uCardPos.value.copy(dir).multiplyScalar(s.card.dist);
    u.uCardU.value.copy(cu).multiplyScalar(Math.cos(s.card.roll)).addScaledVector(cv, Math.sin(s.card.roll));
    u.uCardV.value.crossVectors(dir, u.uCardU.value);
    u.uCardHalf.value.set(s.card.half[0], s.card.half[1]);
    u.uCardLo.value = s.card.lo;
    u.uCardGain.value = t.card ? s.card.gain : 0;
    u.uTrace.value = t.trace ? 1 : 0;
    u.uShadows.value = t.shadows ? 1 : 0;
  }

  // ── Geometry ────────────────────────────────────────────────────────────
  // `mesh`: { vertices, normals, triangles } as the pendant builder makes it
  // (flat in XY, z from 0 to its thickness). `info`: { thickness, edgeRound,
  // rimRound, rimDrop, rimWidth, extent, rimR } in the same units.

  // The distance map for a mesh, built from its rig-space outline. One is
  // built at a time; a request that is no longer wanted by the time its turn
  // comes (or by the time it is done) resolves to null.
  async buildSdf(mesh, info, wanted = () => true) {
    while (this.building) { await this.building; if (!wanted()) return null; }
    const t0 = performance.now(), n = mesh.vertices.length, pos = new Float32Array(n);
    for (let i = 0; i < n; i += 3) { pos[i] = mesh.vertices[i]; pos[i + 1] = -mesh.vertices[i + 1]; pos[i + 2] = info.thickness / 2 - mesh.vertices[i + 2]; }
    this.building = requestSdf(pos, mesh.triangles, info.extent * 1.2);
    const sdf = await this.building;
    this.building = null;
    return wanted() ? { ...sdf, ms: performance.now() - t0 } : null;
  }

  // Start on a pendant's distance map ahead of time; hand the result to
  // reveal() so the metal can arrive the moment it is asked for.
  prepare(mesh, info) { return this.buildSdf(mesh, info); }

  applyGeometry(mesh, info) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = geo; } else {
      this.mesh = new THREE.Mesh(geo, this.goldMat);
      this.mesh.renderOrder = 3;   // over the box, for the hand-over between the two
      this.object.add(this.mesh);
    }
    this.triangles = mesh.triangles.length / 3;
    const u = this.uniforms;
    this.half = info.thickness / 2;
    this.rig.position.z = this.half;
    u.uHalf.value = this.half;
    u.uRound.value = Math.min(info.edgeRound, this.half);
    u.uOutR.value = Math.max(info.rimRound, 0.01);
    u.uOutZ.value = Math.min(info.rimDrop, this.half);
    u.uRimR.value = info.rimR ?? 100;
    u.uSplit.value = u.uRimR.value + Math.min(5, 0.4 * (info.rimWidth ?? 12));
    u.uPlaneZ.value = this.plane.position.z = -this.half - this.look.gap;
  }

  applySdf(sdf) {
    const u = this.uniforms, old = u.uSdf.value;
    const tex = new THREE.DataTexture(sdf.data, sdf.size, sdf.size, THREE.RGFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    u.uSdf.value = tex;
    old?.dispose();
    u.uExtent.value = sdf.extent;
    this.box.scale.set(sdf.extent * 0.98, sdf.extent * 0.98, 1);
    this.sdfMs = sdf.ms;
    this.ready = true;
    this.object.visible = true;
  }

  // Replace the pendant on screen straight away, with no animation: for live
  // setting changes. Its distance map follows a moment later; until then
  // shadows and reflections are the previous shape's.
  async setMesh(mesh, info) {
    const gen = ++this.gen;
    this.applyGeometry(mesh, info);
    if (!this.anim || this.anim.phase === 'posed') this.settle();
    this.render();
    const sdf = await this.buildSdf(mesh, info, () => gen === this.gen);
    if (!sdf) return false;
    this.applySdf(sdf);
    this.render();
    return true;
  }

  // Bring a new pendant in. Whatever is showing drains out first (unless it
  // already has); the new metal then arrives from the rim. `prepared` is the
  // promise from prepare(), if the distance map was started early.
  async reveal(mesh, info, play = DEFAULT_PLAY, prepared = null) {
    const gen = ++this.gen;
    const sdf = (prepared && await prepared) || await this.buildSdf(mesh, info, () => gen === this.gen);
    if (!sdf || gen !== this.gen) return false;
    const arrive = () => { this.applyGeometry(mesh, info); this.applySdf(sdf); this.begin('arrive', play); this.onArriving?.(); this.onArriving = null; };
    const phase = this.anim?.phase;
    if (!this.ready || !this.mesh || phase === 'rim') arrive();
    else if (phase === 'exit') this.anim.then = arrive;
    else { this.begin('exit', play); this.anim.then = arrive; }
    return true;
  }

  // Take the inside away and leave the rim, until the next reveal().
  drain(play = DEFAULT_PLAY) {
    this.gen++;   // a pendant still on its way belongs to the chart that is going
    if (!this.ready || !this.mesh) return;
    const phase = this.anim?.phase;
    if (phase === 'rim') return;
    if (phase === 'exit') { this.anim.then = null; return; }
    this.begin('exit', { ...play, loop: false });
  }

  // One round, or with play.loop round after round (the lab): out, a pause, in, a pause.
  play(play) { if (this.ready && this.mesh) this.begin('exit', play); }

  // Hold an arrival or an exit at one moment (0 to 1) so it can be looked at.
  pose(part, play, at) {
    if (!this.ready || !this.mesh) return;
    this.anim = { phase: 'posed' };
    if (part === 'exit') this.poseExit(play, at); else this.poseArrive(play, at);
  }

  // ── Animation ───────────────────────────────────────────────────────────

  begin(phase, play, now = performance.now()) {
    this.anim = { phase, start: now, play, then: null };
    this.render();
  }

  get animating() {
    const a = this.anim;
    return !!a && (a.phase === 'exit' || a.phase === 'arrive' || (a.play?.loop && (a.phase === 'rim' || a.phase === 'hold')));
  }

  // On-demand viewers: ask for frames for as long as something is moving.
  render() {
    if (!this.requestRender || this.raf) return;
    const tick = () => {
      this.raf = 0;
      this.requestRender();
      if (this.animating) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // Call before each render.
  update(camera, now = performance.now()) {
    const u = this.uniforms;
    this.rig.updateWorldMatrix(true, false);
    u.uRigInv.value.copy(this.rig.matrixWorld).invert();
    u.uCam.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(u.uRigInv.value);
    this.advance(now);
  }

  advance(now) {
    let a = this.anim;
    if (!a || a.phase === 'posed' || !this.mesh || !this.ready) return;
    const p = a.play;
    if (a.phase === 'exit') {
      const ms = p.exit === 'cut' ? 0 : p.exitMs;
      if (now - a.start < ms) { this.poseExit(p, (now - a.start) / ms); return; }
      const then = a.then;
      this.anim = a = { phase: 'rim', start: now, play: p, then: null };
      this.poseRim(p);
      if (then) { then(); return; }
    }
    if (a.phase === 'rim') {
      if (!p.loop || now - a.start < LEAD_MS) { this.poseRim(p); return; }
      this.anim = a = { phase: 'arrive', start: now, play: p, then: null };
    }
    if (a.phase === 'arrive') {
      const at = (now - a.start) / p.ms;
      if (at < 1) { this.poseArrive(p, at); return; }
      this.settle();
      this.anim = p.loop ? { phase: 'hold', start: now, play: p, then: null } : null;
      this.onArrived?.();
      return;
    }
    if (a.phase === 'hold' && now - a.start >= HOLD_MS) this.anim = { phase: 'exit', start: now, play: p, then: null };
  }

  // The finished state: the real mesh, fully there.
  settle() {
    const u = this.uniforms;
    u.uMode.value = 0; u.uP.value = 1; u.uAlpha.value = 1; u.uShadowGain.value = 1; u.uGlint.value = 1e5; u.uKeepRim.value = 0;
    // The shadow's shape reads the thickness and rounding in every state, so they rest at the finished values.
    this.shape(1, u.uRound.value, u.uRound.value);
    this.box.visible = false;
    if (this.mesh) this.mesh.visible = true;
  }

  // Thickness (1 = finished) and edge rounding of the changing solid, and the box it is drawn in.
  shape(rise, dome, drop) {
    const u = this.uniforms;
    u.uRise.value = rise; u.uDome.value = dome; u.uDrop.value = drop;
    u.uTop.value = -this.half + 2 * this.half * Math.max(1, rise) + 0.2;
    const bottom = -this.half - 0.2;
    this.box.scale.z = u.uTop.value - bottom;
    this.box.position.z = (u.uTop.value + bottom) / 2;
  }

  // Between the inside leaving and the next arriving: the rim alone, or nothing.
  poseRim(p) {
    const u = this.uniforms;
    u.uKeepRim.value = p.keepRim ? 1 : 0;
    u.uMode.value = p.keepRim ? 5 : 0;   // "flow in" at its very start is exactly the rim
    u.uP.value = 0; u.uAlpha.value = 0; u.uGlint.value = 1e5;
    u.uShadowGain.value = p.keepRim ? 1 : 0;
    this.mesh.visible = p.keepRim;   // the rim's outer part; its inside is at uAlpha 0
    this.box.visible = p.keepRim;
    this.shape(1, u.uRound.value, u.uRound.value);
  }

  // The metal arriving, `at` from 0 to 1 along the timing curve.
  poseArrive(p, at) {
    const u = this.uniforms, round = u.uRound.value, q = clamp01(bezier(this.curve, clamp01(at)));
    const mode = MARCHED[p.kind] || 0, marched = mode > 0;
    u.uKeepRim.value = p.keepRim ? 1 : 0;
    u.uMode.value = mode;
    // The reshaping arrivals end by dissolving into the real mesh over their slow tail, rather than cutting to it.
    const handover = marched ? smooth((q - 0.95) / 0.05) : 0;
    this.mesh.visible = !marched || handover > 0 || p.keepRim;
    this.box.visible = marched;
    u.uAlpha.value = marched ? handover : p.kind === 'glint' ? smooth(q / 0.55) : q;
    u.uShadowGain.value = marched ? 1 : u.uAlpha.value;
    u.uGlint.value = p.kind === 'glint' ? lerp(-1.3, 1.3, q) * u.uExtent.value : 1e5;
    let rise = 1, dome = round, drop = round;
    if (p.kind === 'outline') u.uP.value = q;
    if (p.kind === 'rise') rise = Math.max(0.03, back(q));
    if (p.kind === 'liquid') { u.uP.value = q; rise = Math.max(0.03, back(q)); dome = lerp(18, round, q); drop = lerp(2 * this.half, round, q); }
    if (p.kind === 'pour' || p.kind === 'flow') { u.uP.value = q; dome = lerp(8, round, q); drop = lerp(2 * this.half, round, q); }
    this.shape(rise, dome, drop);
  }

  // The inside leaving, `at` from 0 to 1 along the same timing curve.
  poseExit(p, at) {
    const u = this.uniforms, round = u.uRound.value, e = clamp01(bezier(this.curve, clamp01(at)));
    const marched = p.exit !== 'fade';
    u.uKeepRim.value = p.keepRim ? 1 : 0;
    u.uGlint.value = 1e5;
    u.uMode.value = p.exit === 'sink' ? 3 : p.exit === 'drain' ? 5 : 0;   // sink: the liquid arrival backwards; drain: flow in backwards
    u.uP.value = 1 - e;
    // Sink and drain dissolve from the real mesh into the changing solid over their first half, the arrival's hand-over in reverse.
    u.uAlpha.value = marched ? 1 - smooth(e / 0.5) : 1 - e;
    u.uShadowGain.value = marched ? 1 : 1 - e;
    this.mesh.visible = u.uAlpha.value > 0 || p.keepRim;
    this.box.visible = marched;
    this.shape(p.exit === 'sink' ? Math.max(0.03, 1 - e) : 1, lerp(round, p.exit === 'sink' ? 14 : 8, e), lerp(round, 2 * this.half, e));
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.gen++;
    this.anim = null;
    this.mesh?.geometry.dispose();
    this.plane.geometry.dispose(); this.plane.material.dispose();
    this.box.geometry.dispose(); this.box.material.dispose();
    this.goldMat.dispose();
    this.uniforms.uSdf.value?.dispose();
  }
}
