// Organic outline styles for the pendant (prototype, Nov 2026).
//
// Each builder takes the same chords as buildPendantModel() and returns the
// serialized outline data that buildPendant3D() consumes directly (it skips
// MakerJS and serializeChainsFor3D entirely). See tools/organic-compare/ for
// the comparison harness.

import { buildTaperedOutline, TAPERED_DEFAULTS } from './outline-tapered.js';
import { buildLiquidOutline, LIQUID_DEFAULTS } from './outline-liquid.js';
import { buildPebbleOutline, PEBBLE_DEFAULTS } from './outline-pebble.js';

export const OUTLINE_STYLES = {
  tapered: { build: buildTaperedOutline, defaults: TAPERED_DEFAULTS },
  liquid: { build: buildLiquidOutline, defaults: LIQUID_DEFAULTS },
  pebble: { build: buildPebbleOutline, defaults: PEBBLE_DEFAULTS },
};

export function buildOrganicOutline(style, chords, circleRadius, borderThickness, options = {}) {
  const entry = OUTLINE_STYLES[style];
  if (!entry) throw new Error('Unknown outline style: ' + style);
  return entry.build(chords, circleRadius, borderThickness, options);
}

export { outlineDataToLoops, outlineSVG, castabilityMetrics } from './outline-common.js';
