import { ringFamily, RING_FAMILIES } from './families.mjs';
import { validateMesh } from './validate.mjs';
import { meshToSTL } from './stl.mjs';
import { sampleWallThickness } from './wall.mjs';

/** The worker and tests execute the same family/validation/export boundary. */
export function runRingJob(request, registry = RING_FAMILIES) {
  const { id, params, quality, family = 'wave', selection = 0 } = request;
  const identity = { id, quality, family, selection }, started = performance.now();
  try {
    if (!['preview', 'settled', 'export'].includes(quality)) throw new Error('Unknown mesh quality.');
    const mesh = ringFamily(family, registry).build(params, quality);
    if (mesh.family !== family || mesh.units !== 'mm' || mesh.quality !== quality) throw new Error('The generator returned a different shape identity.');
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
      return { message: { ...identity, params: mesh.params, stl, report, wall, timing }, transfer: [stl] };
    }
    return { message: { ...identity, mesh, report, wall, timing }, transfer: [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer] };
  } catch (error) { return { message: { ...identity, error: error instanceof Error ? error.message : 'Geometry failed.' }, transfer: [] }; }
}
