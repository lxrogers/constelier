import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

/** Fixed-size contact shadow, refreshed only when geometry changes. */
export class ContactShadow {
  target = new THREE.WebGLRenderTarget(512, 512);
  scratch = new THREE.WebGLRenderTarget(512, 512);
  camera = new THREE.OrthographicCamera(-19, 19, 19, -19, 0, 24);
  depth = new THREE.MeshDepthMaterial();
  horizontal = new THREE.ShaderMaterial(HorizontalBlurShader);
  vertical = new THREE.ShaderMaterial(VerticalBlurShader);
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.horizontal);
  blurScene = new THREE.Scene();
  blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  plane = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), new THREE.MeshBasicMaterial({ map: this.target.texture, transparent: true, depthWrite: false, opacity: 0.42, toneMapped: false }));
  constructor() {
    this.depth.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3(0.24, 0.21, 0.17), pow(fragCoordZ, 2.0) );');
    };
    this.plane.rotation.x = -Math.PI / 2;
    // Top camera's screen up is -Z, matching the horizontal plane's +V.
    this.camera.up.set(0, 0, -1);
    this.blurCamera.position.z = 1;
    this.blurScene.add(this.quad);
    this.horizontal.uniforms.h.value = 2.8 / 512;
    this.vertical.uniforms.v.value = 2.8 / 512;
    this.horizontal.depthTest = this.vertical.depthTest = false;
    this.horizontal.depthWrite = this.vertical.depthWrite = false;
  }
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, y: number) {
    this.plane.position.y = y;
    this.camera.position.set(0, y + 24, 0);
    this.camera.lookAt(0, y, 0);
    const target = renderer.getRenderTarget();
    const clearColor = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    const override = scene.overrideMaterial;
    this.plane.visible = false;
    scene.overrideMaterial = this.depth;
    renderer.setClearColor(0, 0);
    renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(scene, this.camera);
    scene.overrideMaterial = override;
    this.horizontal.uniforms.tDiffuse.value = this.target.texture;
    this.quad.material = this.horizontal;
    renderer.setRenderTarget(this.scratch); renderer.clear(); renderer.render(this.blurScene, this.blurCamera);
    this.vertical.uniforms.tDiffuse.value = this.scratch.texture;
    this.quad.material = this.vertical;
    renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(this.blurScene, this.blurCamera);
    renderer.setRenderTarget(target); renderer.setClearColor(clearColor, alpha);
    this.plane.visible = true;
  }
  dispose() {
    this.target.dispose(); this.scratch.dispose(); this.depth.dispose(); this.horizontal.dispose(); this.vertical.dispose();
    this.quad.geometry.dispose(); this.plane.geometry.dispose(); this.plane.material.dispose();
  }
}
