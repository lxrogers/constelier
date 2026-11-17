// Three.js stage for the shader lab: one pendant on a surface, drawn either
// with the traced gold (modules/traced-gold, the same code the configurator
// uses) or with a stock PBR material, so the two can be compared at the same
// camera. The stage's own space is the traced gold's rig space.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { LOOKS, TracedPendant } from '@/modules/traced-gold/traced-pendant';

export type StageScene = 'stone' | 'wall';
export type StageLook = 'traced' | 'stock';
export type RevealKind = 'fade' | 'glint' | 'outline' | 'rise' | 'liquid' | 'pour' | 'flow';
export type ExitKind = 'cut' | 'fade' | 'sink' | 'drain';
export interface RevealPlay { kind: RevealKind; ms: number; loop: boolean; keepRim: boolean; exit: ExitKind; exitMs: number }
// A CSS-style cubic-bezier timing curve: [x1, y1, x2, y2].
export type Curve = [number, number, number, number];
export interface StageOptions { scene: StageScene; look: StageLook; trace: boolean; shadows: boolean; card: boolean }
export interface StageMesh { vertices: Float32Array; normals: Float32Array; triangles: Uint32Array; thickness: number; edgeRound: number; rimRound: number; rimDrop: number; extent: number }
export interface StageStats { fps: number; width: number; height: number; triangles: number; sdfMs: number }

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

// Where the camera starts in each scene.
const VIEWS = {
  stone: { up: [0, 0, 1], camera: [50, -430, 400], target: [0, 10, 0], fov: 30 },
  wall: { up: [0, 1, 0], camera: [0, 30, 860], target: [0, 30, 0], fov: 30 },
} as const;

export class ShaderStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 5, 6000);
  private controls: OrbitControls | null = null;
  private traced = new TracedPendant();
  // Mesh space → rig space: turned over and centred on its thickness, as the traced gold does.
  private model = new THREE.Group();
  private stockGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1, roughness: 0.05 });
  private stockMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.stockGold);
  private stockPlane = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 1, metalness: 0, envMapIntensity: 0.6 }));
  private sun = new THREE.DirectionalLight(0xfff2dd, 3);
  private options: StageOptions = { scene: 'stone', look: 'traced', trace: true, shadows: true, card: true };
  private playing: RevealPlay | null = null;
  private half = 6;
  private raf = 0;
  private observer: ResizeObserver;
  private last = 0;
  private frameMs = 16.7;
  private env: THREE.Texture | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.model.rotation.x = Math.PI;
    this.model.add(this.traced.object, this.stockMesh);
    this.stockMesh.castShadow = true;
    this.stockPlane.receiveShadow = true;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0004;
    Object.assign(this.sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 1600 });
    this.scene.add(this.model, this.stockPlane, this.sun, this.sun.target);

    new RGBELoader().load('/softbox-2k.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.env = tex;
      this.traced.setEnvironment(tex);
      this.scene.environment = tex;
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.applyScene(true);
    this.raf = requestAnimationFrame(this.tick);
  }

  setMesh(m: StageMesh) {
    this.half = m.thickness / 2;
    this.model.position.z = this.half;
    const arriving = this.traced.setMesh(m, { thickness: m.thickness, edgeRound: m.edgeRound, rimRound: m.rimRound, rimDrop: m.rimDrop, extent: m.extent, rimR: 100 });
    this.stockMesh.geometry = this.traced.mesh.geometry;
    this.applyScene(false);
    // Once its distance map is in, pick the round back up on the new pendant.
    arriving.then((ok: boolean) => { if (ok && this.playing && this.options.look === 'traced') this.traced.play(this.playing); });
  }

  setOptions(o: StageOptions) {
    const sceneChanged = o.scene !== this.options.scene;
    this.options = o;
    this.applyScene(sceneChanged);
  }

  private applyScene(moveCamera: boolean) {
    const o = this.options, look = LOOKS[o.scene], view = VIEWS[o.scene], traced = o.look === 'traced';
    this.traced.setLook(look);
    this.traced.setToggles({ trace: o.trace, shadows: o.shadows, card: o.card });
    // The stock comparison: Three.js's standard metal, lit from the same sun.
    this.stockMesh.visible = this.stockPlane.visible = this.sun.visible = !traced;
    this.stockPlane.position.z = -this.half - look.gap;
    (this.stockPlane.material as THREE.MeshStandardMaterial).color.set(look.surface ? 0xd9d3c6 : 0xcfc8ba);
    this.sun.position.copy(v3(look.sunDir).normalize()).multiplyScalar(700);
    this.scene.environmentRotation.set(look.up[2] ? Math.PI / 2 : 0, 0, 0);
    this.renderer.toneMapping = traced ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    if (moveCamera) {
      // OrbitControls reads the camera's up axis once, so it is rebuilt per scene.
      this.controls?.dispose();
      this.camera.up.copy(v3(view.up));
      this.camera.fov = view.fov;
      this.camera.position.copy(v3(view.camera));
      this.camera.updateProjectionMatrix();
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.minDistance = 120;
      this.controls.maxDistance = 1600;
      this.controls.target.copy(v3(view.target));
      this.controls.update();
    }
  }

  // Plays one round: the inside leaves, a short pause with whatever is kept, then the metal arrives.
  playReveal(play: RevealPlay) {
    this.playing = play;
    if (this.options.look === 'traced') this.traced.play(play);
  }

  setCurve(curve: Curve) { this.traced.setCurve(curve); }

  // Holds an arrival, or an exit, at one moment (0 to 1) so it can be inspected.
  poseReveal(kind: RevealKind, at: number, keepRim = true) {
    this.playing = null;
    this.traced.pose('arrive', { kind, keepRim }, at);
  }

  poseExit(exit: ExitKind, at: number, keepRim = true) {
    this.playing = null;
    this.traced.pose('exit', { exit, keepRim }, at);
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private draw() {
    this.camera.updateMatrixWorld();
    this.traced.update(this.camera);
    // The traced gold shows itself once its first distance map is in; the stock look overrides that.
    this.traced.object.visible = this.options.look === 'traced' && this.traced.ready;
    this.renderer.render(this.scene, this.camera);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (this.last) this.frameMs += (now - this.last - this.frameMs) * 0.05;
    this.last = now;
    this.controls?.update();
    this.draw();
  };

  stats(): StageStats {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { fps: 1000 / this.frameMs, width: size.x, height: size.y, triangles: this.traced.triangles, sdfMs: this.traced.sdfMs };
  }

  // Renders `frames` frames back to back and waits for the GPU each time, to
  // see how long a frame really takes when the display's refresh rate is not
  // the limit. Returns milliseconds per frame.
  benchmark(frames = 60): number {
    const gl = this.renderer.getContext(), px = new Uint8Array(4);
    this.draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      this.draw();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return (performance.now() - t0) / frames;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.controls?.dispose();
    this.traced.dispose();
    this.env?.dispose();
    this.stockGold.dispose();
    this.stockPlane.geometry.dispose();
    (this.stockPlane.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
