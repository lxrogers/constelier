import test from 'node:test';
import assert from 'node:assert/strict';
import { createRingRegistry, RING_FAMILIES, ringFamily, serializeRing, parseRing } from '../../modules/rings/families.mjs';
import { initialRingDesign, reduceRingDesign } from '../../modules/rings/design.mjs';
import { runRingJob } from '../../modules/rings/job.mjs';
import { meshToSTL } from '../../modules/rings/stl.mjs';
import { WAVE_DEFAULTS, buildWave, serializeWave } from '../../modules/rings/wave.mjs';
import { FIXTURE_FAMILY } from './family-fixture.mjs';

const registry = createRingRegistry([RING_FAMILIES.wave, FIXTURE_FAMILY]);
const reduce = (state, action) => reduceRingDesign(state, action, registry);

test('registry keeps the original family contract and rejects unknown/prototype keys', () => {
  assert.equal(ringFamily('fixture', registry).build, FIXTURE_FAMILY.build);
  for (const key of ['missing', '__proto__', 'constructor']) assert.throws(() => ringFamily(key, registry), /Unknown/);
  assert.throws(() => createRingRegistry([FIXTURE_FAMILY, FIXTURE_FAMILY]), /duplicate/);
  assert.throws(() => createRingRegistry([{ id: 'empty' }]), /Incomplete/);
  assert(Object.isFrozen(registry)); assert(Object.isFrozen(registry.wave));
});

test('switching family atomically resets presets, controls and normalized parameters', () => {
  let state = initialRingDesign();
  state = reduce(state, { type: 'parameter', key: 'width', value: 6.4 });
  state = reduce(state, { type: 'family', family: 'fixture' });
  assert.equal(state.family, 'fixture'); assert.equal(state.preset, 'fixture-ribbon');
  assert.equal(state.params.width, 1.6); assert.equal(state.selection, 1);
  assert.deepEqual(state.adjustments, []);
  assert.throws(() => reduce(state, { type: 'parameter', key: 'radial', value: 1 }), /Unknown/);
  assert.throws(() => reduce(state, { type: 'preset', preset: 'tide' }), /Unknown/);
  state = reduce(state, { type: 'preset', preset: 'fixture-swell' }); assert.equal(state.params.width, 5.3);
  state = reduce(state, { type: 'family', family: 'wave' });
  assert.equal(state.selection, 2); assert.deepEqual(state.params, WAVE_DEFAULTS);
  assert.equal(reduce(state, { type: 'family', family: 'wave' }), state);
});

test('parameter edits keep the current scope and report clamps', () => {
  const initial = initialRingDesign('fixture', registry);
  const changed = reduce(initial, { type: 'parameter', key: 'width', value: 100 });
  assert.equal(changed.params.width, 7); assert.equal(changed.selection, initial.selection);
  assert.equal(changed.preset, 'custom'); assert(changed.adjustments.length);
  assert.equal(initial.params.width, 1.6, 'preset source/state must not mutate');
});

test('identical presets and repeated clamped inputs retain geometry identity without hiding notices', () => {
  const initial = initialRingDesign();
  assert.equal(reduce(initial, { type: 'preset', preset: 'tide' }).params, initial.params);
  assert.equal(reduce(initial, { type: 'parameter', key: 'width', value: initial.params.width }).params, initial.params);
  const atLimit = reduce(initial, { type: 'parameter', key: 'width', value: 100 });
  const clampedAgain = reduce(atLimit, { type: 'parameter', key: 'width', value: 100 });
  assert.equal(clampedAgain.params, atLimit.params); assert(clampedAgain.adjustments.length);
  const reset = reduce(clampedAgain, { type: 'preset', preset: 'tide' });
  assert.notEqual(reset.params, atLimit.params); assert.equal(reset.params.width, 4.3);
});

test('family-aware links preserve legacy wave JSON and round-trip each registered family', () => {
  assert.equal(serializeRing('wave', WAVE_DEFAULTS), serializeWave(WAVE_DEFAULTS));
  for (const family of Object.values(registry)) {
    const state = initialRingDesign(family.id, registry);
    const text = serializeRing(state.family, state.params, registry);
    const parsed = parseRing(text, registry);
    assert.equal(parsed.family, family.id); assert.deepEqual(parsed.params, state.params);
    const loaded = reduce(initialRingDesign(), { type: 'load', text });
    assert.equal(loaded.family, family.id); assert.equal(loaded.selection, 1); assert.equal(loaded.preset, 'custom');
  }
});

test('invalid or unavailable-family links reject instead of silently switching generators', () => {
  for (const text of ['null', '{}', '{bad', JSON.stringify({ version: 2, family: 'wave', params: {} }), JSON.stringify({ version: 1, family: 'unavailable-test-family', params: {} }), JSON.stringify({ version: 1, family: 'wave', params: [] }), 'x'.repeat(2049)]) assert.throws(() => parseRing(text));
});

test('worker dispatch and transfer carry the selected family and selection identity', () => {
  for (const family of Object.values(registry)) {
    const { message, transfer } = runRingJob({ id: 42, family: family.id, selection: 7, quality: 'preview', params: family.presets[0].params }, registry);
    assert.equal(message.error, undefined); assert.equal(message.family, family.id); assert.equal(message.mesh.family, family.id);
    assert.equal(message.selection, 7); assert.equal(message.id, 42); assert.equal(transfer.length, 3);
    assert.equal(transfer[0], message.mesh.positions.buffer);
  }
});

test('worker rejects a generator that silently returns a different family, units or quality', () => {
  for (const mismatch of [{ family: 'wave' }, { units: 'cm' }, { quality: 'export' }]) {
    const invalid = createRingRegistry([{ ...FIXTURE_FAMILY, build: (params, quality) => ({ ...FIXTURE_FAMILY.build(params, quality), ...mismatch }) }]);
    const { message, transfer } = runRingJob({ id: 1, family: 'fixture', selection: 3, quality: 'preview', params: WAVE_DEFAULTS }, invalid);
    assert.match(message.error, /different shape identity/); assert.equal(message.family, 'fixture'); assert.equal(message.selection, 3); assert.deepEqual(transfer, []);
  }
});

test('worker errors retain request identity and never build an unregistered family', () => {
  const { message, transfer } = runRingJob({ id: 9, family: 'unavailable-test-family', selection: 11, quality: 'preview', params: {} });
  assert.match(message.error, /Unknown ring family/); assert.equal(message.id, 9); assert.equal(message.family, 'unavailable-test-family'); assert.equal(message.selection, 11); assert.deepEqual(transfer, []);
});

test('export uses the captured family and parameters even after design changes', () => {
  let state = initialRingDesign('fixture', registry);
  const captured = { id: 1, quality: 'export', family: state.family, params: { ...state.params } };
  state = reduce(state, { type: 'family', family: 'wave' });
  state = reduce(state, { type: 'parameter', key: 'width', value: 6.4 });
  const { message, transfer } = runRingJob(captured, registry);
  assert.equal(message.error, undefined); assert.equal(message.family, 'fixture'); assert.equal(message.params.width, 1.6);
  assert.deepEqual(new Uint8Array(message.stl), new Uint8Array(meshToSTL(buildWave(captured.params, 'export'))));
  assert.equal(transfer[0], message.stl); assert.equal(state.family, 'wave'); assert.equal(state.params.width, 6.4);
});
