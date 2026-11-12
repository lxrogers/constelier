import { WAVE_CONTROLS, WAVE_PRESETS, normalizeWave, buildWave, serializeWave, parseWave } from './wave.mjs';
import { LIQUID_ACCENT_FAMILY } from './liquid-accent.mjs';
import { FACETED_FAMILY } from './faceted.mjs';

/** Integration owns registration. Family modules retain the original contract. */
export function createRingRegistry(definitions) {
  const registry = Object.create(null);
  for (const family of definitions) {
    if (!/^[a-z][a-z0-9-]*$/.test(family.id) || Object.hasOwn(registry, family.id)) throw new Error('Invalid or duplicate ring family.');
    if (!family.name || !family.controls?.length || !family.presets?.length || ['normalize', 'build', 'serialize', 'parse'].some(key => typeof family[key] !== 'function')) throw new Error(`Incomplete ring family: ${family.id}.`);
    registry[family.id] = Object.freeze({ ...family });
  }
  return Object.freeze(registry);
}

export const RING_FAMILIES = createRingRegistry([
  { id: 'wave', name: 'Continuous wave', controls: [...WAVE_CONTROLS.filter(c => c.group === 'Wave'), ...WAVE_CONTROLS.filter(c => c.group !== 'Wave')], presets: WAVE_PRESETS, normalize: normalizeWave, build: buildWave, serialize: serializeWave, parse: parseWave },
  LIQUID_ACCENT_FAMILY,
  FACETED_FAMILY,
]);

export function ringFamily(id, registry = RING_FAMILIES) {
  if (!Object.hasOwn(registry, id)) throw new Error('Unknown ring family.');
  return registry[id];
}

export function serializeRing(family, params, registry = RING_FAMILIES) {
  return ringFamily(family, registry).serialize(params);
}

export function parseRing(text, registry = RING_FAMILIES) {
  if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid ring parameters.');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || typeof data.family !== 'string' || !data.params || typeof data.params !== 'object' || Array.isArray(data.params)) throw new Error('Unsupported ring preset.');
  const family = ringFamily(data.family, registry);
  return { family: family.id, ...family.parse(text) };
}
