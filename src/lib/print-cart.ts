// The lab's 3D-print cart: pendants saved with the exact settings they were
// previewed with, exported as real-size STLs plus a manifest a printing agent
// can follow.
import { buildExportMesh, meshOptionsFor } from '@/modules/pendant-build';
import { meshToSTL } from '@/modules/fast-pendant-mesh';
import { mmPerUnit, type PendantParams } from '@/config/pendant-params';
import type { BirthData, Chord } from '@/lib/natal-chords';
import { makeZip } from '@/lib/zip';

export interface PrintItem {
  id: string;
  label: string;
  addedAt: number;
  params: PendantParams;
  chords: Chord[];
  birth?: BirthData & { location?: string };
  thumbnail?: string | null;
}

export const PRINT_CART_KEY = 'constelier-lab-print-cart';

export function outlineParamsFor(p: PendantParams, chords: Chord[]) {
  return {
    style: p.outlineStyle,
    chords,
    circleRadius: 100,
    borderThickness: p.borderThickness,
    expansion: p.lineThickness,
    minArea: p.minArea,
    minAngle: p.minAngle,
    filletRadius: p.filletRadius,
    liquidity: p.liquidity,
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pendant';
}

function meshVolume(V: Float32Array, T: Uint32Array) {
  let vol = 0;
  for (let t = 0; t < T.length; t += 3) {
    const a = 3 * T[t], b = 3 * T[t + 1], c = 3 * T[t + 2];
    vol += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1])
         - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c])
         + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]);
  }
  return Math.abs(vol / 6);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// Builds every item's watertight mesh (yielding between items so the page
// stays responsive) and zips STLs + manifest.json.
export async function exportPrintCart(items: PrintItem[], onProgress?: (done: number, total: number) => void) {
  const files: { name: string; data: ArrayBuffer | string }[] = [];
  const manifestItems = [];
  for (let i = 0; i < items.length; i++) {
    onProgress?.(i, items.length);
    await tick();
    const it = items[i];
    const p = it.params;
    const scale = mmPerUnit(p);
    const mesh = buildExportMesh(outlineParamsFor(p, it.chords), meshOptionsFor(p));
    const file = `${String(i + 1).padStart(2, '0')}-${slug(it.label)}.stl`;
    files.push({ name: file, data: meshToSTL(mesh, { scale, header: `Constelier ${it.label}` }) });
    manifestItems.push({
      file,
      label: it.label,
      quantity: 1,
      units: 'mm',
      diameterMm: p.diameterMm,
      thicknessMm: +(p.thickness * scale).toFixed(3),
      rimWidthMm: +(p.borderThickness * scale).toFixed(3),
      volumeMm3: +(meshVolume(mesh.vertices, mesh.triangles) * scale ** 3).toFixed(1),
      triangles: mesh.triangles.length / 3,
      orientation: 'Flat on the bed: the pendant lies in the XY plane, z = 0 is the bottom face.',
      bail: p.bailEnabled ? {
        holeDiameterMm: p.bailInnerMm,
        bandMm: +(p.bailBand * p.borderThickness * scale).toFixed(3),
        outerDiameterMm: +(p.bailInnerMm + 2 * p.bailBand * p.borderThickness * scale).toFixed(2),
        note: 'Flat loop in the same slab as the pendant (flush faces, one solid). Prints flat with no supports.',
      } : null,
      birth: it.birth ?? null,
      settings: p,
      chords: it.chords,
    });
  }
  onProgress?.(items.length, items.length);
  const manifest = {
    kind: 'constelier-print-batch',
    version: 1,
    createdAt: new Date().toISOString(),
    count: manifestItems.length,
    notes: 'Binary STLs in millimetres, one pendant per file, watertight. Print each file once (see quantity).',
    items: manifestItems,
  };
  files.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  return makeZip(files);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
