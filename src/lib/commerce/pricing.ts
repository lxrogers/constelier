import 'server-only';
import { buildExportMesh, OUTLINE_STYLE_IDS } from '@/modules/pendant-build.js';
import type { PendantDesign } from './design';

// ── Pricing knobs (placeholders: set real numbers before launch) ──────────
//
// Physical size: the model's outer edge (circleRadius + border) maps to this
// diameter. Thickness in the model is 5 units, so at 25 mm it casts ~1.2 mm.
export const PENDANT_DIAMETER_MM = 25;
export const MESH_THICKNESS = 5;
export const MESH_FILLET = 2;

export const METAL = {
  name: '14k yellow gold',
  densityGPerCm3: 13.07,
  // Metal cost charged per gram, including casting loss.
  pricePerGramCents: 9500,
};

// Labour, finishing, chain and packaging.
export const BASE_PRICE_CENTS = 18000;

// Round the final price up to the nearest $5.
const ROUND_TO_CENTS = 500;

export interface Quote {
  unitAmount: number; // cents
  grams: number;
  volumeMm3: number;
  metal: string;
}

export function quoteDesign(design: PendantDesign): Quote {
  const { spec, geometry } = design;
  const style = OUTLINE_STYLE_IDS.includes(spec.outlineStyle) ? spec.outlineStyle : 'current';
  const mesh = buildExportMesh(
    {
      style,
      chords: geometry.chords,
      circleRadius: geometry.circleRadius,
      borderThickness: spec.borderThickness,
      expansion: spec.lineThickness,
      minArea: geometry.minArea,
      minAngle: geometry.minAngle,
      filletRadius: spec.filletRadius,
      liquidity: spec.liquidity,
    },
    { thickness: MESH_THICKNESS, filletR: MESH_FILLET },
  );

  const outerR = geometry.circleRadius + spec.borderThickness;
  const mmPerUnit = PENDANT_DIAMETER_MM / 2 / outerR;
  const volumeMm3 = Math.abs(meshVolume(mesh.vertices, mesh.triangles)) * mmPerUnit ** 3;
  const grams = (volumeMm3 / 1000) * METAL.densityGPerCm3;
  const raw = BASE_PRICE_CENTS + grams * METAL.pricePerGramCents;
  const unitAmount = Math.ceil(raw / ROUND_TO_CENTS) * ROUND_TO_CENTS;
  return { unitAmount, grams, volumeMm3, metal: METAL.name };
}

// Signed volume of a closed triangle mesh (divergence theorem).
function meshVolume(V: Float32Array, T: Uint32Array) {
  let vol = 0;
  for (let t = 0; t < T.length; t += 3) {
    const a = 3 * T[t], b = 3 * T[t + 1], c = 3 * T[t + 2];
    vol += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1])
         - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c])
         + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]);
  }
  return vol / 6;
}
