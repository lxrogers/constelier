// Test-only adapter of the existing wave generator. This is not a new family.
import { normalizeWave, buildWave, WAVE_PRESETS, WAVE_CONTROLS } from '../../modules/rings/wave.mjs';

export const FIXTURE_FAMILY = {
  id: 'fixture', name: 'Fixture alternate', normalize: normalizeWave,
  controls: WAVE_CONTROLS.filter(c => c.key !== 'radial'),
  presets: WAVE_PRESETS.slice(1).map(p => ({ ...p, id: `fixture-${p.id}`, name: `Fixture ${p.name}`, params: { ...p.params } })),
  build(input, quality) { return { ...buildWave(input, quality), family: 'fixture' }; },
  serialize(input) { return JSON.stringify({ version: 1, family: 'fixture', params: normalizeWave(input).params }); },
  parse(text) {
    const data = JSON.parse(text);
    if (data.version !== 1 || data.family !== 'fixture') throw new Error('Invalid fixture.');
    return normalizeWave(data.params);
  },
};
