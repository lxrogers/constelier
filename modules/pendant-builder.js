import { serializeChainsFor3D } from './pendant-geometry.js';
import { initOpenCascade, isOCReady, buildPendant3D, buildRing3D, filletShape } from './replicad-pipeline.js';

export function preloadWASM() {
  return initOpenCascade();
}

export async function buildPendant3DFromModel(makerModel, circleRadius, borderThickness, options = {}) {
  const { thickness = 10, filletR = 3 } = options;

  if (!isOCReady()) await initOpenCascade();

  const serialized = serializeChainsFor3D(makerModel, circleRadius, borderThickness);
  const result = buildPendant3D(serialized, thickness);

  if (filletR > 0) {
    const filleted = filletShape(result.shape, thickness, filletR);
    result.shape = filleted.shape;
    result.filletInfo = filleted.filletInfo;
  }

  return result;
}

export async function buildRing3DShape(circleRadius, borderThickness, options = {}) {
  const { thickness = 10, filletR = 3 } = options;

  if (!isOCReady()) await initOpenCascade();

  const result = buildRing3D(circleRadius, borderThickness, thickness);

  if (filletR > 0) {
    const filleted = filletShape(result.shape, thickness, filletR);
    result.shape = filleted.shape;
  }

  return result;
}
