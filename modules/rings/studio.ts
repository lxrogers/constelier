import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ContactShadow } from './contact-shadow';

/** Ring-specific studio. Geometry stays in mm; camera never resets on an edit. */
export class RingStudio {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mesh: THREE.Mesh;
  gold = new THREE.MeshStandardMaterial({ color: 0xe8bc72, metalness: 1, roughness: 0.18, envMapIntensity: 1.05 });
  neutral = new THREE.MeshStandardMaterial({ color: 0x7a8388, metalness: 0, roughness: 0.7, envMapIntensity: 0.3 });
  contact = new ContactShadow();
  environment: THREE.WebGLRenderTarget;
  observer: ResizeObserver;
  frame = 0;
  dead = false;
  hdrLoaded = false;
  renderCount = 0;
  constructor(private host: HTMLElement, onLighting: (status: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0xf2efe8, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive ring. Drag to orbit; scroll to zoom.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.style.touchAction = 'none';
    host.appendChild(this.renderer.domElement);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.gold);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8d7e69, 0.9));
    const key = new THREE.DirectionalLight(0xfff5e6, 2.3);
    key.position.set(-22, 45, 22);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe7efff, 0.9);
    fill.position.set(25, 15, -25);
    this.scene.add(fill);
    this.scene.add(this.contact.plane);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.enablePan = false;
    this.controls.minDistance = 26;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.addEventListener('change', this.draw);
    this.resetView();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentRotation.set(344 * Math.PI / 180, 308 * Math.PI / 180, 0);
    onLighting('Studio lighting');
    new RGBELoader().load('/softbox.hdr', hdr => {
      if (this.dead) { hdr.dispose(); pmrem.dispose(); return; }
      // The shared asset is 4096×2048. Cap the reflection input at 1024×512
      // before PMREM (256px cube faces), otherwise software/mobile GPUs pay for
      // a 1024px PMREM cube although the ring occupies only a few hundred pixels.
      const source = hdr.image as { data: Uint16Array; width: number; height: number };
      if (source.width > 1024) {
        const width = 1024, height = Math.round(source.height * width / source.width);
        const data = new Uint16Array(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const at = (Math.floor(y * source.height / height) * source.width + Math.floor(x * source.width / width)) * 4;
          data.set(source.data.subarray(at, at + 4), (y * width + x) * 4);
        }
        hdr.image = { data, width, height }; hdr.needsUpdate = true;
      }
      this.environment.dispose();
      this.environment = pmrem.fromEquirectangular(hdr);
      this.scene.environment = this.environment.texture;
      hdr.dispose(); pmrem.dispose();
      this.hdrLoaded = true;
      onLighting('Softbox studio');
      this.draw();
    }, undefined, () => {
      pmrem.dispose();
      if (!this.dead) onLighting('Studio lighting · HDR unavailable');
    });
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }
  resize = () => {
    if (this.dead) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75, Math.sqrt(2500000 / (width * height))));
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // Responsive framing without changing the user's orbit or distance.
    this.camera.fov = 34 / Math.min(1, Math.max(0.65, this.camera.aspect));
    this.camera.updateProjectionMatrix();
    this.draw();
  };
  draw = () => {
    if (this.dead || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.dead) { this.renderer.render(this.scene, this.camera); this.renderCount++; }
    });
  };
  update(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();
    const old = this.mesh.geometry;
    this.mesh.geometry = geometry;
    old.dispose();
    this.contact.update(this.renderer, this.scene, data.bounds.minY - 0.12);
    this.draw();
  }
  setMaterial(mode: 'gold' | 'neutral') { this.mesh.material = mode === 'gold' ? this.gold : this.neutral; this.draw(); }
  resetView() {
    this.camera.position.set(28, 29, 38);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.draw();
  }
  view(direction: 'top' | 'side' | 'hero') {
    if (direction === 'hero') return this.resetView();
    this.camera.position.set(...(direction === 'top' ? [0, 53, 0.01] : [0, 3, 53]) as [number, number, number]);
    this.controls.target.set(0, 0, 0); this.controls.update(); this.draw();
  }
  diagnostics() {
    return { geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, triangles: this.renderer.info.render.triangles, renderCount: this.renderCount, hdrLoaded: this.hdrLoaded, camera: this.camera.position.toArray(), material: this.mesh.material === this.gold ? 'gold' : 'neutral' };
  }
  dispose() {
    this.dead = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose();
    this.mesh.geometry.dispose(); this.gold.dispose(); this.neutral.dispose();
    this.contact.dispose();
    this.scene.traverse(obj => { if (obj instanceof THREE.Light && 'shadow' in obj) (obj as THREE.DirectionalLight).shadow?.dispose(); });
    this.environment.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
