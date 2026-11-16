// The lab's photo renders: a pendant's STL is sent to the Blender render API
// on Modal (tools/blender/modal_render.py) through /api/lab/render, which
// keeps the API token on the server.
import { buildExportMesh, meshOptionsFor } from '@/modules/pendant-build';
import { meshToSTL } from '@/modules/fast-pendant-mesh';
import { mmPerUnit, type PendantParams } from '@/config/pendant-params';
import { outlineParamsFor } from '@/lib/print-cart';
import type { Chord } from '@/lib/natal-chords';

export type RenderScene = 'wall' | 'stone';
export type RenderQuality = 'draft' | 'standard' | 'high';

export const RENDER_SCENES: { id: RenderScene; label: string }[] = [
  { id: 'wall', label: 'Against a wall' },
  { id: 'stone', label: 'On speckled stone' },
];

export const RENDER_QUALITIES: { id: RenderQuality; label: string; hint: string }[] = [
  { id: 'draft', label: 'Draft', hint: '960 × 1200, under a minute' },
  { id: 'standard', label: 'Standard', hint: '1600 × 2000, a few minutes' },
  { id: 'high', label: 'High', hint: '2400 × 3000, several minutes' },
];

export interface RenderJob {
  id: string;
  remoteId?: string;
  label: string;
  scene: RenderScene;
  quality: RenderQuality;
  status: 'building' | 'rendering' | 'done' | 'failed';
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

export const RENDERS_KEY = 'constelier-lab-renders';

export const renderImageUrl = (job: RenderJob) => `/api/lab/render/${job.remoteId}`;

// The same real-size (mm) binary STL the print cart exports.
export function buildPendantSTL(params: PendantParams, chords: Chord[]): ArrayBuffer {
  const mesh = buildExportMesh(outlineParamsFor(params, chords), meshOptionsFor(params));
  return meshToSTL(mesh, { scale: mmPerUnit(params), header: 'Constelier render' });
}

export async function submitRender(stl: ArrayBuffer, scene: RenderScene, quality: RenderQuality): Promise<string> {
  const res = await fetch(`/api/lab/render?scene=${scene}&quality=${quality}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: stl,
  });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d?.id) throw new Error(d?.error || d?.detail || `Render API answered ${res.status}`);
  return d.id;
}

// 'rendering' until the image exists; throws with the API's reason if it failed.
export async function checkRender(remoteId: string): Promise<'rendering' | 'done'> {
  const res = await fetch(`/api/lab/render/${remoteId}`);
  if (res.status === 202) return 'rendering';
  if (res.ok) { res.body?.cancel(); return 'done'; }
  const d = await res.json().catch(() => null);
  throw new Error(d?.error || d?.detail || `Render API answered ${res.status}`);
}
