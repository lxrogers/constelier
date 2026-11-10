// modules/pendant-build.js
//
// One place that turns chart chords into the pendant outline and its mesh,
// for every outline style, with no OpenCascade. Used by the chart page (in a
// Web Worker when it can), the generate route and the STL route.
//
//   style 'current' — today's outline (MakerJS bars + 2D fillet)
//   style 'liquid'  — distance-field smooth union; `blend` is the liquidity
//   style 'pebble'  — rounded, bowed voids

import { buildPendantModel, serializeChainsFor3D } from './pendant-geometry.js';
import { buildOrganicOutline, outlineDataToLoops } from './organic/index.js';
import { buildPreviewMesh, buildPendantMesh } from './fast-pendant-mesh.js';

export const OUTLINE_STYLE_IDS = ['current', 'liquid', 'pebble'];

// Liquidity slider: the smooth-min radius of the Liquid field, in model units
// (the circle is r = 100). Low = crisp bars, high = metal pooled into a
// poured, mostly solid disc. 11 is the default the organic thread tuned.
export const LIQUIDITY = { min: 2, max: 30, step: 0.5, default: 11 };

// Field grid spacing while a slider is being dragged vs. at rest.
export const LIQUID_RESOLUTION = { drag: 0.5, rest: 0.25 };

export function outlineData({
  style = 'current', chords, circleRadius = 100, borderThickness = 8,
  expansion = 3, minArea = 185, minAngle = 5, filletRadius = 5,
  liquidity, draft = false,
}) {
  if (style === 'liquid' || style === 'pebble') {
    const opts = { midHalfWidth: expansion, minArea, minAngle };
    if (style === 'liquid') {
      if (typeof liquidity === 'number') opts.blend = Math.min(LIQUIDITY.max, Math.max(LIQUIDITY.min, liquidity));
      opts.resolution = draft ? LIQUID_RESOLUTION.drag : LIQUID_RESOLUTION.rest;
    }
    return buildOrganicOutline(style, chords, circleRadius, borderThickness, opts);
  }
  const model = buildPendantModel(chords, expansion, circleRadius, borderThickness, minArea, minAngle, filletRadius);
  return serializeChainsFor3D(model, circleRadius, borderThickness);
}

// Narrowest bar or border: caps the edge rounding where the full radius
// won't fit (the same step-down OpenCascade's fillet did).
export function minFeatureFor({ expansion = 3, borderThickness = 8 }) {
  return Math.min(2 * expansion, borderThickness > 0 ? borderThickness : Infinity);
}

// Preview mesh (indexed, with normals) plus the void outlines as polylines
// for the 2D chart canvas.
export function buildPreview(params, { thickness = 5, filletR = 2 } = {}) {
  const data = outlineData(params);
  const mesh = buildPreviewMesh(data, { thickness, filletR, minFeature: minFeatureFor(params) });
  const loops = outlineDataToLoops(data, 0.6);
  return { mesh, loops };
}

// Watertight mesh for export.
export function buildExportMesh(params, { thickness = 5, filletR = 2 } = {}) {
  const data = outlineData(params);
  return buildPendantMesh(data, { thickness, filletR, minFeature: minFeatureFor(params) });
}
