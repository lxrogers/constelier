import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { TAARenderPass } from "three/addons/postprocessing/TAARenderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

export const MESH_QUALITY_PRESETS = {
  draft:  { tolerance: 0.5, angularTolerance: 10 },
  medium: { tolerance: 0.1, angularTolerance: 2 },
  high:   { tolerance: 0.02, angularTolerance: 0.5 },
};

const ColorGradingShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'saturation': { value: 0.85 },
    'contrast': { value: 0.90 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    varying vec2 vUv;
    vec3 adjustSaturation(vec3 color, float adj) {
      vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
      return mix(gray, color, adj);
    }
    vec3 adjustContrast(vec3 color, float adj) {
      return (color - 0.5) * adj + 0.5;
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = adjustSaturation(color.rgb, saturation);
      color.rgb = adjustContrast(color.rgb, contrast);
      gl_FragColor = color;
    }
  `,
};

function createGroundGradientTexture(size, middleStop, endStop, intensity) {
  var canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  var cx = size / 2, cy = size / 2, maxR = size / 2;
  var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * endStop);
  var w = Math.min(255, 255 * intensity);
  var mg = Math.min(255, 153 * intensity);
  var dg = Math.min(255, 102 * intensity);
  grad.addColorStop(0, 'rgb(' + w + ',' + w + ',' + w + ')');
  grad.addColorStop(middleStop, 'rgb(' + mg + ',' + mg + ',' + mg + ')');
  grad.addColorStop(1, 'rgb(' + dg + ',' + dg + ',' + dg + ')');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export class PendantViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.running = false;
    this.animationTime = 0;

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initLighting();
    if (options.enableGroundPlane !== false) this._initGroundPlane();
    if (options.enableControls !== false) this._initControls();
    if (options.enablePostProcessing !== false) this._initPostProcessing();
    if (options.enableHDRI !== false) this._loadHDRI(options.hdriPath || './softbox.hdr');

    this.pendantGroup = new THREE.Group();
    // +PI/2 rotation: model (x, y, z) → world (x, -z, y)
    // Top-down camera sees: screen-right = +x, screen-down = +y (matches canvas Y-down)
    this.pendantGroup.rotation.x = Math.PI / 2;
    this.scene.add(this.pendantGroup);

    this._faceMat = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      metalness: 1.0,
      roughness: options.roughness ?? 0.3,
      envMapIntensity: 1.0,
      polygonOffset: options.enableEdges !== false,
      polygonOffsetFactor: 2.0,
      polygonOffsetUnits: 1.0,
    });
    this._edgeMat = new THREE.LineBasicMaterial({ color: 0x8b7335 });
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = this.options.background != null
      ? new THREE.Color(this.options.background)
      : new THREE.Color(0xffffff);
  }

  _initCamera() {
    var w = this.container.clientWidth || this.container.width || 700;
    var h = this.container.clientHeight || this.container.height || 700;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    this.camera.position.set(0, 0, 500);
  }

  _initRenderer() {
    var isCanvas = this.container instanceof HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({
      canvas: isCanvas ? this.container : undefined,
      antialias: true,
      powerPreference: "high-performance",
      alpha: true,
    });
    var w = this.container.clientWidth || this.container.width || 700;
    var h = this.container.clientHeight || this.container.height || 700;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (!isCanvas) {
      this.container.appendChild(this.renderer.domElement);
    }
  }

  _initControls() {
    var el = this.renderer.domElement;
    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }

  _initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.1));

    this._sideLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this._sideLight.position.set(-200, 350, -200);
    this._sideLight.castShadow = true;
    this._sideLight.shadow.mapSize.width = 4096;
    this._sideLight.shadow.mapSize.height = 4096;
    this._sideLight.shadow.camera.near = 0.1;
    this._sideLight.shadow.camera.far = 2000;
    this._sideLight.shadow.camera.left = -600;
    this._sideLight.shadow.camera.right = 600;
    this._sideLight.shadow.camera.top = 600;
    this._sideLight.shadow.camera.bottom = -600;
    this._sideLight.shadow.bias = -0.0001;
    this._sideLight.shadow.normalBias = 0.02;
    this.scene.add(this._sideLight);

    this._sideLight2 = new THREE.DirectionalLight(0xffffff, 3.0);
    this._sideLight2.position.set(200, 350, -200);
    this._sideLight2.castShadow = true;
    this._sideLight2.shadow.mapSize.width = 4096;
    this._sideLight2.shadow.mapSize.height = 4096;
    this._sideLight2.shadow.camera.near = 0.1;
    this._sideLight2.shadow.camera.far = 2000;
    this._sideLight2.shadow.camera.left = -600;
    this._sideLight2.shadow.camera.right = 600;
    this._sideLight2.shadow.camera.top = 600;
    this._sideLight2.shadow.camera.bottom = -600;
    this._sideLight2.shadow.bias = -0.0001;
    this._sideLight2.shadow.normalBias = 0.02;
    this.scene.add(this._sideLight2);

    this._initialLightPositions = {
      light1: { x: -200, y: 350, z: -200 },
      light2: { x: 200, y: 350, z: -200 },
    };

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-300, 100, -100);
    this.scene.add(fillLight);

    var pointLightPositions = [
      { x: 120, y: 150, z: 120 },
      { x: -120, y: 150, z: 120 },
      { x: 0, y: 180, z: 0 },
      { x: 120, y: 120, z: -120 },
      { x: -120, y: 120, z: -120 },
    ];
    pointLightPositions.forEach((pos) => {
      var pl = new THREE.PointLight(0xffffff, 3.0, 1000);
      pl.position.set(pos.x, pos.y, pos.z);
      pl.decay = 2;
      this.scene.add(pl);
    });
  }

  _initGroundPlane() {
    var groundGeom = new THREE.PlaneGeometry(2000, 2000);
    var groundTex = new THREE.CanvasTexture(createGroundGradientTexture(1024, 0.2, 3.0, 0.8));
    var groundMat = new THREE.MeshStandardMaterial({
      map: groundTex, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.0,
    });
    this._groundPlane = new THREE.Mesh(groundGeom, groundMat);
    this._groundPlane.rotation.x = -Math.PI / 2;
    this._groundPlane.position.y = -5;
    this._groundPlane.receiveShadow = true;
    this._groundPlane.material.color.setRGB(0.5, 0.5, 0.5);
    this.scene.add(this._groundPlane);
  }

  _initPostProcessing() {
    var w = this.container.clientWidth || this.container.width || 700;
    var h = this.container.clientHeight || this.container.height || 700;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    var taaPass = new TAARenderPass(this.scene, this.camera);
    taaPass.sampleLevel = 3;
    this.composer.addPass(taaPass);

    var smaaPass = new SMAAPass(
      w * window.devicePixelRatio,
      h * window.devicePixelRatio,
    );
    smaaPass.enabled = false;
    this.composer.addPass(smaaPass);

    var colorGradingPass = new ShaderPass(ColorGradingShader);
    this.composer.addPass(colorGradingPass);

    var vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms['darkness'].value = 1.2;
    vignettePass.uniforms['offset'].value = 0.9;
    vignettePass.enabled = false;
    this.composer.addPass(vignettePass);
  }

  _loadHDRI(path) {
    var rgbeLoader = new RGBELoader();
    rgbeLoader.load(path, (hdrEquirect) => {
      hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;
      this._hdrTexture = hdrEquirect;
      this.scene.environment = hdrEquirect;
    });
  }

  updateMesh(shape, quality = 'medium') {
    // Clear previous
    while (this.pendantGroup.children.length > 0) {
      var child = this.pendantGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.pendantGroup.remove(child);
    }

    var preset = MESH_QUALITY_PRESETS[quality] || MESH_QUALITY_PRESETS.medium;
    var facesData = shape.mesh(preset);
    var edgesData = shape.meshEdges(preset);

    var faceGeom = new THREE.BufferGeometry();
    faceGeom.setAttribute('position', new THREE.Float32BufferAttribute(facesData.vertices, 3));
    faceGeom.setAttribute('normal', new THREE.Float32BufferAttribute(facesData.normals, 3));
    if (facesData.triangles && facesData.triangles.length > 0) {
      faceGeom.setIndex(facesData.triangles);
    }

    var mesh = new THREE.Mesh(faceGeom, this._faceMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.pendantGroup.add(mesh);

    if (this.options.enableEdges !== false) {
      var edgeGeom = new THREE.BufferGeometry();
      edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgesData.lines, 3));
      var edgeLines = new THREE.LineSegments(edgeGeom, this._edgeMat);
      edgeLines.visible = false;
      this.pendantGroup.add(edgeLines);
    }

    this._fitCamera();
  }

  _buildMeshFromShape(shape, quality) {
    var preset = MESH_QUALITY_PRESETS[quality] || MESH_QUALITY_PRESETS.medium;
    var facesData = shape.mesh(preset);
    var faceGeom = new THREE.BufferGeometry();
    faceGeom.setAttribute('position', new THREE.Float32BufferAttribute(facesData.vertices, 3));
    faceGeom.setAttribute('normal', new THREE.Float32BufferAttribute(facesData.normals, 3));
    if (facesData.triangles && facesData.triangles.length > 0) {
      faceGeom.setIndex(facesData.triangles);
    }
    var mat = this._faceMat.clone();
    mat.transparent = true;
    mat.opacity = 1;
    mat.depthWrite = true;
    var mesh = new THREE.Mesh(faceGeom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  crossFadeMesh(shape, quality, duration) {
    duration = duration || 800;
    var self = this;

    // Cancel any running cross-fade
    if (this._crossFadeId) {
      cancelAnimationFrame(this._crossFadeId);
      this._crossFadeId = null;
    }

    // Tag old children for removal
    var oldChildren = [];
    for (var i = 0; i < this.pendantGroup.children.length; i++) {
      oldChildren.push(this.pendantGroup.children[i]);
    }

    // Build new mesh — renders on top of old to avoid z-fighting
    var newMesh = this._buildMeshFromShape(shape, quality);
    newMesh.material.opacity = 0;
    newMesh.renderOrder = 1;
    this.pendantGroup.add(newMesh);

    // Old meshes: disable depth write so new mesh always wins
    // Both old and new cast shadows — shadow is union of both shapes
    for (var i = 0; i < oldChildren.length; i++) {
      if (oldChildren[i].material) {
        oldChildren[i].material.transparent = true;
        oldChildren[i].material.depthWrite = false;
        oldChildren[i].renderOrder = 0;
      }
    }

    var startTime = null;
    function fadeStep(ts) {
      if (!startTime) startTime = ts;
      var t = Math.min((ts - startTime) / duration, 1);
      // Ease in-out
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      newMesh.material.opacity = e;
      for (var i = 0; i < oldChildren.length; i++) {
        if (oldChildren[i].material) {
          oldChildren[i].material.opacity = 1 - e;
        }
      }

      if (t < 1) {
        self._crossFadeId = requestAnimationFrame(fadeStep);
      } else {
        self._crossFadeId = null;
        // Remove old children
        for (var i = 0; i < oldChildren.length; i++) {
          if (oldChildren[i].geometry) oldChildren[i].geometry.dispose();
          if (oldChildren[i].material && oldChildren[i].material !== self._faceMat) {
            oldChildren[i].material.dispose();
          }
          self.pendantGroup.remove(oldChildren[i]);
        }
        // Final state: fully opaque, no transparency overhead
        newMesh.material.transparent = false;
        newMesh.material.opacity = 1;
        newMesh.renderOrder = 0;
      }
    }

    this._crossFadeId = requestAnimationFrame(fadeStep);
  }

  _fitCamera() {
    var box = new THREE.Box3().setFromObject(this.pendantGroup);
    var center = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z);
    var fov = this.camera.fov * (Math.PI / 180);
    var dist = maxDim / (2 * Math.tan(fov / 2)) * 1.5;
    this.camera.position.set(center.x, center.y + dist, center.z + dist * 0.3);
    if (this.controls) {
      this.controls.target.copy(center);
      this.controls.update();
    } else {
      this.camera.lookAt(center);
    }
    if (this._groundPlane) {
      this._groundPlane.position.y = box.min.y - 2;
    }
    if (this._shadowPlane) {
      this._shadowPlane.position.y = box.min.y - 1;
    }
  }

  fitToRegion(modelRadius) {
    this.fitToRegionExact(modelRadius * 1.1, modelRadius);
  }

  fitToRegionExact(half, modelRadius) {
    var needsNew = !this.camera || !this.camera.isOrthographicCamera;
    if (needsNew) {
      this.camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 2000);
    } else {
      this.camera.left = -half;
      this.camera.right = half;
      this.camera.top = half;
      this.camera.bottom = -half;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0, (modelRadius || half) * 3, 0);
    this.camera.lookAt(0, 0, 0);
    // Reconnect controls to current camera
    if (this.controls) {
      this.controls.object = this.camera;
      this.controls.update();
    }
    // Rebuild post-processing with current camera
    if (this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      var taaPass = new TAARenderPass(this.scene, this.camera);
      taaPass.sampleLevel = 3;
      this.composer.addPass(taaPass);
      var colorGradingPass = new ShaderPass(ColorGradingShader);
      this.composer.addPass(colorGradingPass);
    }
  }

  addShadowPlane(yOffset) {
    if (this._shadowPlane) {
      this.scene.remove(this._shadowPlane);
      this._shadowPlane.geometry.dispose();
      this._shadowPlane.material.dispose();
    }
    var geom = new THREE.PlaneGeometry(2000, 2000);
    var mat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this._shadowPlane = new THREE.Mesh(geom, mat);
    this._shadowPlane.rotation.x = -Math.PI / 2;
    this._shadowPlane.position.y = yOffset != null ? yOffset : -5;
    this._shadowPlane.receiveShadow = true;
    this.scene.add(this._shadowPlane);
  }

  setShadowPlaneY(y) {
    if (this._shadowPlane) this._shadowPlane.position.y = y;
  }

  setShadowOpacity(opacity) {
    if (this._shadowPlane) this._shadowPlane.material.opacity = opacity;
  }

  setRoughness(value) {
    this._faceMat.roughness = value;
  }

  setEdgesVisible(visible) {
    for (var i = 0; i < this.pendantGroup.children.length; i++) {
      if (this.pendantGroup.children[i].isLineSegments) {
        this.pendantGroup.children[i].visible = visible;
      }
    }
  }

  setEnvironment(enabled) {
    this.scene.environment = enabled ? this._hdrTexture : null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._animate();
  }

  stop() {
    this.running = false;
  }

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(() => this._animate());
    if (this.controls) this.controls.update();

    this.animationTime += 0.016 * 0.1;
    var a1 = this.animationTime;
    var ip = this._initialLightPositions;
    this._sideLight.position.x = ip.light1.x + Math.cos(a1) * 100;
    this._sideLight.position.z = ip.light1.z + Math.sin(a1) * 100;
    this._sideLight.position.y = ip.light1.y + Math.sin(a1 * 0.5) * 50;
    var a2 = this.animationTime + Math.PI / 4;
    this._sideLight2.position.x = ip.light2.x + Math.cos(a2) * 100;
    this._sideLight2.position.z = ip.light2.z + Math.sin(a2) * 100;
    this._sideLight2.position.y = ip.light2.y + Math.sin(a2 * 0.5) * 50;

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    var w = this.container.clientWidth || this.container.width || 700;
    var h = this.container.clientHeight || this.container.height || 700;
    if (this.camera.isOrthographicCamera) {
      // Keep aspect ratio for orthographic
    } else {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
  }

  dispose() {
    this.stop();
    while (this.pendantGroup.children.length > 0) {
      var child = this.pendantGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.pendantGroup.remove(child);
    }
    this._faceMat.dispose();
    this._edgeMat.dispose();
    this.renderer.dispose();
  }
}
