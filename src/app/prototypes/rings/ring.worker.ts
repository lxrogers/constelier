/// <reference lib="webworker" />
import { ringFamily } from '@/modules/rings/families.mjs';
import { validateMesh } from '@/modules/rings/validate.mjs';
import { meshToSTL } from '@/modules/rings/stl.mjs';
import { sampleWallThickness } from '@/modules/rings/wall.mjs';

self.onmessage = (event: MessageEvent) => {
  const { id, params, quality, family = 'wave' } = event.data;
  const started = performance.now();
  try {
    const mesh = ringFamily(family).build(params, quality);
    const report = validateMesh(mesh, { intersections: quality !== 'preview', minInnerRadius: mesh.params.innerDiameter / 2 });
    if (!report.valid) throw new Error(report.errors.join(' '));
    let wall = null;
    if (quality !== 'preview') {
      const sampled = sampleWallThickness(mesh, { samples: 256 });
      if (sampled.missedRays || sampled.backfacingHits || sampled.sampledMinWallMm < 0.8) throw new Error('Local wall check failed. Try a thicker or gentler section.');
      wall = { sampledMinWallMm: sampled.sampledMinWallMm, samplesTested: sampled.samplesTested };
    }
    const timing = { generationMs: mesh.generationMs, totalMs: performance.now() - started };
    if (quality === 'export') {
      const stl = meshToSTL(mesh);
      self.postMessage({ id, quality, params: mesh.params, stl, report, wall, timing }, { transfer: [stl] });
    } else {
      self.postMessage({ id, quality, mesh, report, wall, timing }, { transfer: [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer] });
    }
  } catch (error) { self.postMessage({ id, quality, error: error instanceof Error ? error.message : 'Geometry failed.' }); }
};
