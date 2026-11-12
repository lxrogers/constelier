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

// 3D slab settings. `rimRoundness` is how round the outer edge is, as a
// fraction of a full half-round (1 = the rim's cross-section is a semicircle
// of diameter `thickness`). Above 1 the profile stays full height and
// stretches inward into a half-ellipse (2 = reaches in a full thickness), a
// softer taper. `edgeFillet` rounds the void edges. Legacy
// designs (before the rim had its own setting) rounded every edge by 2 on a
// 5-thick slab, which is rimRoundness 0.8.
export const RIM_ROUNDNESS_MAX = 3;
export const MESH_DEFAULTS = { thickness: 5, edgeFillet: 2, rimRoundness: 0.8 };

// The bail is a flat tab at the top, cut from the same slab: its band is
// `bailBand` x the rim width, its neck blends into the rim with arcs of
// `bailBlend` x the rim width, and its outer edge gets the rim's rounding.
// The hole is sized in millimetres (a chain fits a physical hole) and sits
// `bailGapMm` outside the disc's edge.
export const BAIL_DEFAULTS = { innerMm: 3, band: 1, gapMm: 0.3, blend: 1 };
const DEFAULT_DIAMETER_MM = 25;

export function meshOptionsFor({
  thickness = MESH_DEFAULTS.thickness,
  edgeFillet = MESH_DEFAULTS.edgeFillet,
  rimRoundness = MESH_DEFAULTS.rimRoundness,
  borderThickness = 8,
  diameterMm = DEFAULT_DIAMETER_MM,
  bailEnabled = false,
  bailInnerMm = BAIL_DEFAULTS.innerMm,
  bailBand = BAIL_DEFAULTS.band,
  bailGapMm = BAIL_DEFAULTS.gapMm,
  bailBlend = BAIL_DEFAULTS.blend,
} = {}) {
  const t = Math.max(0.5, thickness);
  const rr = Math.min(RIM_ROUNDNESS_MAX, Math.max(0, rimRoundness));
  const opts = {
    thickness: t,
    filletR: Math.max(0, edgeFillet),
    outerFilletR: rr * t / 2,
    outerFilletZ: Math.min(1, rr) * t / 2,
  };
  if (bailEnabled) {
    const outerR = 100 + borderThickness;
    const unitsPerMm = (2 * outerR) / Math.max(1, diameterMm);
    const rim = Math.max(1, borderThickness);
    const innerR = Math.max(0.5, bailInnerMm / 2 * unitsPerMm);
    const band = Math.max(0.5, bailBand * rim);
    const gap = Math.max(0, bailGapMm) * unitsPerMm;
    const cy = -(outerR + gap + innerR);
    // Once the loop clears the disc it stands on a neck formed by the blend
    // arcs. Widen them as needed so that neck is never thinner than 1.5 bands.
    const blend = Math.max(Math.max(0, bailBlend) * rim, minBlendForNeck(outerR, innerR + band, cy, 1.5 * band));
    opts.bail = { cy, innerR, outerR: innerR + band, blend };
  }
  return opts;
}

// Narrowest width of the neck joining the disc (radius A) and the bail tab
// (radius B, centre (0, cy)) with blend arcs of radius f; 0 if they can't join.
function neckWidth(A, B, cy, f) {
  const a = A + f, b = B + f;
  if (-cy >= a + b) return 0;
  const py = (cy * cy - b * b + a * a) / (2 * cy);
  const px = Math.sqrt(Math.max(0, a * a - py * py));
  return Math.max(0, 2 * (px - f));
}

// Smallest blend radius giving a neck at least `minWidth` wide; 0 when the
// loop overlaps the disc enough already. The width rises with the radius,
// peaks, then falls, so scan up from 0 (taking the widest if none is enough).
function minBlendForNeck(A, B, cy, minWidth) {
  if (neckWidth(A, B, cy, 0) >= minWidth) return 0;
  let best = 0, bestW = 0;
  for (let f = 0.25; f <= 4 * B; f += 0.25) {
    const w = neckWidth(A, B, cy, f);
    if (w >= minWidth) return f;
    if (w > bestW) { bestW = w; best = f; }
  }
  return best;
}

// How far the pendant reaches from its centre (model units): the disc's
// radius, or the top of the bail.
export function pendantExtent(meshOpts, borderThickness) {
  const disc = 100 + borderThickness;
  return meshOpts.bail ? Math.max(disc, -meshOpts.bail.cy + meshOpts.bail.outerR) : disc;
}

function withBail(data, meshOpts) {
  return meshOpts.bail ? { ...data, bail: meshOpts.bail } : data;
}

// Narrowest bar or border: caps the edge rounding where the full radius
// won't fit (the same step-down OpenCascade's fillet did).
export function minFeatureFor({ expansion = 3, borderThickness = 8 }) {
  return Math.min(2 * expansion, borderThickness > 0 ? borderThickness : Infinity);
}

// Preview mesh (indexed, with normals) plus the void outlines as polylines
// for the 2D chart canvas.
export function buildPreview(params, meshOpts = meshOptionsFor()) {
  const data = outlineData(params);
  const mesh = buildPreviewMesh(withBail(data, meshOpts), { ...meshOpts, minFeature: minFeatureFor(params) });
  const loops = outlineDataToLoops(data, 0.6);
  return { mesh, loops };
}

// Just the void outlines (no mesh), for animation frames on the 2D canvas.
export function buildOutlineLoops(params) {
  return outlineDataToLoops(outlineData(params), 0.6);
}

// Watertight mesh for export.
export function buildExportMesh(params, meshOpts = meshOptionsFor()) {
  const data = outlineData(params);
  return buildPendantMesh(withBail(data, meshOpts), { ...meshOpts, minFeature: minFeatureFor(params) });
}
