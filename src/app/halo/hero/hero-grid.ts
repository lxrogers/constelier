// The hero's last shot pulls back to show its pendant is one of twelve, laid
// out 4 across and 3 down, each from a different sky. Only the hero's own is
// real metal. The other eleven are pictures of real pendants on their charts,
// taken from straight above by the homepage in dev (/?grid=1, see
// bakeGrid) and laid flat on the paper by the shader.
import * as THREE from 'three';
import { LOOKS } from '@/modules/traced-gold/traced-pendant';
import type { ChartEngine } from '@/app/chart/chart-engine';
import type { Sky } from './hero-director';

export const GRID = { cols: 4, rows: 3, col: 2, row: 1 };   // the hero's own place: third in the second row
export const GRID_GAP = 1.14;                                // neighbours sit this many chart-widths apart
const TILE = 512;                                            // each picture's size in pixels
const url = (i: number) => `/hero/grid/${String(i).padStart(2, '0')}.webp`;

// The neighbours, reading across each row and skipping the hero's own place.
export const GRID_SKIES: Sky[] = [
  { label: '2 February 1975 · Tokyo', year: 1975, month: 2, day: 2, hour: 6, minute: 10, lat: 35.6762, lon: 139.6503 },
  { label: '14 July 1988 · Lisbon', year: 1988, month: 7, day: 14, hour: 14, minute: 45, lat: 38.7223, lon: -9.1393 },
  { label: '30 October 2001 · Mexico City', year: 2001, month: 10, day: 30, hour: 9, minute: 25, lat: 19.4326, lon: -99.1332 },
  { label: '8 May 1962 · Cairo', year: 1962, month: 5, day: 8, hour: 20, minute: 5, lat: 30.0444, lon: 31.2357 },
  { label: '19 September 1993 · Vancouver', year: 1993, month: 9, day: 19, hour: 1, minute: 50, lat: 49.2827, lon: -123.1207 },
  { label: '25 April 1980 · Mumbai', year: 1980, month: 4, day: 25, hour: 16, minute: 35, lat: 19.076, lon: 72.8777 },
  { label: '11 November 2015 · Reykjavik', year: 2015, month: 11, day: 11, hour: 11, minute: 11, lat: 64.1466, lon: -21.9426 },
  { label: '6 June 1971 · Buenos Aires', year: 1971, month: 6, day: 6, hour: 4, minute: 20, lat: -34.6037, lon: -58.3816 },
  { label: '23 December 1998 · Seoul', year: 1998, month: 12, day: 23, hour: 23, minute: 30, lat: 37.5665, lon: 126.978 },
  { label: '17 March 2006 · Nairobi', year: 2006, month: 3, day: 17, hour: 7, minute: 55, lat: -1.2921, lon: 36.8219 },
  { label: '1 August 1985 · Berlin', year: 1985, month: 8, day: 1, hour: 13, minute: 15, lat: 52.52, lon: 13.405 },
];

// The neighbours' pictures as one texture, in their places. Null if they have not been taken yet.
export async function loadGrid(): Promise<THREE.CanvasTexture | null> {
  const load = (i: number) => new Promise<HTMLImageElement>((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = fail; img.src = url(i); });
  let images: HTMLImageElement[];
  try { images = await Promise.all(GRID_SKIES.map((_, i) => load(i))); } catch { return null; }
  const sheet = document.createElement('canvas');
  sheet.width = GRID.cols * TILE; sheet.height = GRID.rows * TILE;
  const ctx = sheet.getContext('2d');
  let n = 0;
  for (let row = 0; row < GRID.rows; row++) for (let col = 0; col < GRID.cols; col++) {
    if (row === GRID.row && col === GRID.col) continue;
    ctx.drawImage(images[n++], col * TILE, row * TILE, TILE, TILE);
  }
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace;        // the pictures are screen colour; the shader works in linear and encodes on the way out
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export interface GridBakeStatus { done: number; finished: boolean; error?: string }

// Makes each neighbour in turn with the real engine and photographs it from
// straight above, in full sun, its chart filling the picture.
export async function bakeGrid(engine: ChartEngine, viewer: any, canvas2d: HTMLCanvasElement, stage: HTMLCanvasElement, status: GridBakeStatus) {
  const traced = viewer.traced, u = traced.uniforms;
  traced.setLook(LOOKS.chart);
  traced.setEnvRotation(0, 0);
  u.uWindow.value = 0; u.uGobo.value = 0;
  const chart = new THREE.CanvasTexture(canvas2d);
  chart.colorSpace = THREE.SRGBColorSpace;
  const half = engine.chartHalf();
  traced.setChart(chart, half);
  traced.object.visible = true;
  const camera = viewer.camera as THREE.PerspectiveCamera, rig = traced.rig as THREE.Object3D;
  const out = document.createElement('canvas');
  out.width = out.height = TILE;
  const draw = () => {
    rig.updateWorldMatrix(true, false);
    const far = 5200;                                         // far enough that the view is nearly flat
    camera.position.set(0, 0, far).applyMatrix4(rig.matrixWorld);
    camera.up.set(0, 1, 0).transformDirection(rig.matrixWorld);
    camera.lookAt(new THREE.Vector3().applyMatrix4(rig.matrixWorld));
    camera.fov = 2 * Math.atan(half / far) * 180 / Math.PI;
    camera.near = 50; camera.far = 9000;
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    chart.needsUpdate = true;
    viewer.renderOnce();
  };
  const frame = () => new Promise<void>((ok) => requestAnimationFrame(() => { draw(); ok(); }));
  try {
    for (let i = 0; i < GRID_SKIES.length; i++) {
      engine.setBirth(GRID_SKIES[i]);
      // The new pendant has landed once its arrival has begun and then ended.
      const start = performance.now();
      let arriving = false;
      for (;;) {
        await frame();
        const phase = traced.anim?.phase;
        if (phase === 'arrive') arriving = true;
        else if (arriving && !phase) break;
        if (performance.now() - start > 40000) throw new Error(`pendant ${i} never arrived`);
      }
      for (let k = 0; k < 45; k++) await frame();              // let the chart's dots and the hand-over settle
      draw();                                                 // drawn in this very task, so the canvas can be read
      const side = stage.height;
      out.getContext('2d').drawImage(stage, (stage.width - side) / 2, 0, side, side, 0, 0, TILE, TILE);
      const blob = await new Promise<Blob>((ok) => out.toBlob((b) => ok(b), 'image/webp', 0.92));
      const saved = await fetch(`/api/lab/bake?name=grid/${String(i).padStart(2, '0')}.webp`, { method: 'POST', body: blob });
      if (!saved.ok) throw new Error(`saving picture ${i}: ${saved.status}`);
      status.done = i + 1;
    }
    status.finished = true;
  } catch (err) {
    status.error = String((err as Error)?.message || err);
  }
}
