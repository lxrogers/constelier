'use client';

// Builds and renders the lab's sample pendants with the current settings.
//
// Performance: one Web Worker builds the pendants one after another, and a
// new settings change abandons the rest of a pass (latest wins). Changes are
// debounced, longer while a slider is mid-drag, so the main preview gets the
// CPU first. One offscreen WebGL viewer renders every card and copies the
// frame into the card's 2D canvas, instead of a GPU context per card.
// Lighting-only changes re-render the cached meshes without rebuilding.

import { useEffect, useMemo, useRef, useState } from 'react';
import { meshOptionsFor, pendantExtent } from '@/modules/pendant-build';
import { chordsForBirth, type Chord } from '@/lib/natal-chords';
import { outlineParamsFor } from '@/lib/print-cart';
import type { PendantParams } from '@/config/pendant-params';
import type { LabSample } from '@/config/lab-samples';

export type CardStatus = { state: 'idle' | 'building' | 'ready' | 'empty' | 'error'; ms?: number };

interface MeshData { vertices: Float32Array; normals: Float32Array; triangles: Uint32Array }

const VIEW_PX = 320;          // CSS px of the offscreen render
const FRAME_MIN = 126;        // model units visible from centre to edge (grows to fit a bail)
const CAMERA_DIST = 2000;     // matches PendantViewer.fitToRegionExact
const CAMERA_THROTTLE = 120;
const DEBOUNCE = { draft: 450, rest: 120 };
const LOOK_DEBOUNCE = 40;

const geometryKey = (p: PendantParams) => JSON.stringify([
  p.outlineStyle, p.liquidity, p.lineThickness, p.filletRadius, p.minArea, p.minAngle,
  p.borderThickness, p.rimRoundness, p.thickness, p.edgeFillet,
  // the bail is sized in mm, so overall size moves it
  p.bailEnabled && [p.diameterMm, p.bailInnerMm, p.bailBand, p.bailGapMm, p.bailBlend],
]);

export function usePendantGrid(samples: LabSample[], params: PendantParams, draft: boolean) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [status, setStatus] = useState<CardStatus[]>(() => samples.map(() => ({ state: 'idle' })));

  const aspectsKey = [...params.aspects].sort().join(',');
  const chords = useMemo<Chord[][]>(
    () => samples.map((s) => { try { return chordsForBirth(s, params.aspects); } catch { return []; } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [samples, aspectsKey],
  );

  const workerRef = useRef<Worker | null>(null);
  const viewerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const viewerReady = useRef<Promise<void> | null>(null);
  const meshes = useRef<(MeshData | null)[]>([]);
  const gen = useRef(0);
  const frameHalf = useRef(FRAME_MIN);
  const cameraDir = useRef<number[] | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Worker + viewer live for the page's lifetime.
  useEffect(() => {
    let disposed = false;
    workerRef.current = new Worker(new URL('../app/chart/pendant.worker.ts', import.meta.url), { type: 'module' });
    viewerReady.current = (async () => {
      const { PendantViewer } = await import('@/modules/three-pendant-viewer');
      const canvas = document.createElement('canvas');
      canvas.width = VIEW_PX; canvas.height = VIEW_PX;
      const p = paramsRef.current;
      const viewer = new PendantViewer(canvas, {
        enableControls: false, enableEdges: false, enableGroundPlane: false,
        enableHDRI: true, hdriPath: '/softbox-2k.hdr', enablePostProcessing: true,
        background: null, roughness: p.roughness, maxPixelRatio: 2,
      });
      viewer.scene.background = null;
      viewer.scene.environmentRotation?.set(p.hdriRx * Math.PI / 180, p.hdriRy * Math.PI / 180, 0);
      if (viewer.hdriReady) await viewer.hdriReady.catch(() => {});
      viewer.addShadowPlane(-(p.thickness + 2));
      frameHalf.current = Math.max(FRAME_MIN, pendantExtent(meshOptionsFor(p), p.borderThickness) + 6);
      viewer.fitToRegionExact(frameHalf.current, 100 + p.borderThickness);
      if (disposed) { viewer.dispose(); return; }
      viewerRef.current = viewer;
    })();
    return () => {
      disposed = true;
      gen.current++;
      workerRef.current?.terminate();
      workerRef.current = null;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  function paint(i: number) {
    const viewer = viewerRef.current, mesh = meshes.current[i], out = canvases.current[i];
    if (!viewer || !out) return;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, out.width, out.height);
    if (!mesh) return;
    viewer.swapMeshFromData(mesh); // renders once
    ctx.drawImage(viewer.renderer.domElement, 0, 0, out.width, out.height);
  }

  function build(i: number, p: PendantParams, myGen: number): Promise<void> {
    return new Promise((resolve) => {
      const w = workerRef.current;
      if (!w || myGen !== gen.current) return resolve();
      const id = `${myGen}:${i}`;
      const onMsg = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        w.removeEventListener('message', onMsg);
        if (myGen === gen.current) {
          if (e.data.error) {
            setStatus((s) => s.map((v, k) => (k === i ? { state: 'error' } : v)));
          } else {
            meshes.current[i] = e.data.mesh;
            paint(i);
            setStatus((s) => s.map((v, k) => (k === i ? { state: 'ready', ms: e.data.ms } : v)));
          }
        }
        resolve();
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ id, params: { ...outlineParamsFor(p, chords[i]), draft: false }, meshOpts: meshOptionsFor(p) });
    });
  }

  // Geometry or chords changed: rebuild every card.
  const gKey = geometryKey(params);
  useEffect(() => {
    const myGen = ++gen.current;
    const timer = setTimeout(async () => {
      await viewerReady.current;
      if (myGen !== gen.current) return;
      const p = paramsRef.current;
      const viewer = viewerRef.current;
      viewer?.setShadowPlaneY(-(p.thickness + 2));
      const half = Math.max(FRAME_MIN, pendantExtent(meshOptionsFor(p), p.borderThickness) + 6);
      if (viewer && Math.abs(half - frameHalf.current) > 0.5) {
        frameHalf.current = half;
        viewer.fitToRegionExact(half, 100 + p.borderThickness); // resets to top-down
        const d = cameraDir.current;
        if (d) { viewer.camera.position.set(d[0] * CAMERA_DIST, d[1] * CAMERA_DIST, d[2] * CAMERA_DIST); viewer.camera.lookAt(0, 0, 0); }
      }
      setStatus(samples.map((_, i) => (chords[i].length ? { state: 'building' } : { state: 'empty' })));
      for (let i = 0; i < samples.length; i++) {
        if (myGen !== gen.current) return;
        if (!chords[i].length) { meshes.current[i] = null; paint(i); continue; }
        await build(i, p, myGen);
      }
    }, draft ? DEBOUNCE.draft : DEBOUNCE.rest);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gKey, chords, draft]);

  // Lighting only: re-render cached meshes.
  useEffect(() => {
    const timer = setTimeout(() => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.setRoughness(params.roughness);
      viewer.scene.environmentRotation?.set(params.hdriRx * Math.PI / 180, params.hdriRy * Math.PI / 180, 0);
      for (let i = 0; i < samples.length; i++) paint(i);
    }, LOOK_DEBOUNCE);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.roughness, params.hdriRx, params.hdriRy]);

  // Follow the main view's orbit angle (lab emits `pendant-camera`).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dir: number[] | null = null;
    const apply = () => {
      timer = null;
      const viewer = viewerRef.current;
      if (!viewer || !dir) return;
      viewer.camera.position.set(dir[0] * CAMERA_DIST, dir[1] * CAMERA_DIST, dir[2] * CAMERA_DIST);
      viewer.camera.lookAt(0, 0, 0);
      for (let i = 0; i < samples.length; i++) paint(i);
    };
    const onCamera = (e: Event) => {
      dir = (e as CustomEvent).detail?.dir;
      cameraDir.current = dir;
      if (!timer) timer = setTimeout(apply, CAMERA_THROTTLE);
    };
    window.addEventListener('pendant-camera', onCamera);
    return () => { window.removeEventListener('pendant-camera', onCamera); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Small JPEG of a card for the print cart.
  function thumbnail(i: number) {
    const c = canvases.current[i];
    if (!c) return null;
    const out = document.createElement('canvas');
    out.width = 160; out.height = 160;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, 160, 160);
    ctx.drawImage(c, 0, 0, 160, 160);
    return out.toDataURL('image/jpeg', 0.8);
  }

  return { canvases, status, chords, thumbnail };
}
