import { WAVE_CONTROLS, WAVE_PRESETS, normalizeWave, buildWave, serializeWave, parseWave } from './wave.mjs';

/** Later family modules implement this small contract; integration owns this map. */
export const RING_FAMILIES = {
  wave: { id: 'wave', name: 'Continuous wave', controls: WAVE_CONTROLS, presets: WAVE_PRESETS, normalize: normalizeWave, build: buildWave, serialize: serializeWave, parse: parseWave },
};
export function ringFamily(id) {
  const family = RING_FAMILIES[id];
  if (!family) throw new Error('Unknown ring family.');
  return family;
}
