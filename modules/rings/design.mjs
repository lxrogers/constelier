import { ringFamily, parseRing, RING_FAMILIES } from './families.mjs';

export function initialRingDesign(family = 'wave', registry = RING_FAMILIES, selection = 0) {
  const definition = ringFamily(family, registry), preset = definition.presets[0];
  return { family, selection, preset: preset.id, ...definition.normalize(preset.params) };
}

function updateParameters(state, normalized, preset) {
  const same = Object.keys(state.params).length === Object.keys(normalized.params).length &&
    Object.entries(normalized.params).every(([key, value]) => state.params[key] === value);
  // Preset labels and clamp notices may change without changing the geometry.
  // Preserve the parameter reference so the hook does not enqueue identical work.
  return { ...state, ...normalized, preset, params: same ? state.params : normalized.params };
}

/** Family and parameter changes are one atomic state transition. */
export function reduceRingDesign(state, action, registry = RING_FAMILIES) {
  if (action.type === 'family') return action.family === state.family ? state : initialRingDesign(action.family, registry, state.selection + 1);
  if (action.type === 'load') {
    const parsed = parseRing(action.text, registry);
    return { ...parsed, preset: 'custom', selection: state.selection + 1 };
  }
  const family = ringFamily(state.family, registry);
  if (action.type === 'preset') {
    const preset = family.presets.find(p => p.id === action.preset);
    if (!preset) throw new Error('Unknown ring preset.');
    return updateParameters(state, family.normalize(preset.params), preset.id);
  }
  if (action.type === 'parameter') {
    if (!family.controls.some(control => control.key === action.key)) throw new Error('Unknown ring control.');
    return updateParameters(state, family.normalize({ ...state.params, [action.key]: action.value }), 'custom');
  }
  throw new Error('Unknown ring design action.');
}
