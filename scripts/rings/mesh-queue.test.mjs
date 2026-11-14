import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshQueue } from '../../modules/rings/mesh-queue.mjs';

function harness(sendHook) {
  const sent = [], published = [], statuses = [], errors = [];
  const queue = createMeshQueue({ send: job => { sent.push(job); sendHook?.(job); }, publish: result => published.push(result), setStatus: status => statuses.push(status), setError: error => errors.push(error) });
  const complete = (job, extra = {}) => queue.complete({ ...job, mesh: { params: job.params }, ...extra });
  return { queue, sent, published, statuses, errors, complete };
}

for (const interval of [1000 / 60, 1000 / 120, 1]) {
  test(`keeps displaying progress with ${interval.toFixed(2)} ms inputs and 22 ms jobs`, () => {
    let now = 0, running = 0, peak = 0;
    const events = [], commits = [];
    const h = harness(job => { running++; peak = Math.max(peak, running); events.push({ at: now + 22, complete: job }); });
    for (let time = 0, value = 0; time < 1000; time += interval, value++) events.push({ at: time, value });
    events.push({ at: 1000, value: 12345 });
    events.push({ at: 1220, value: 12345, quality: 'settled' });
    while (events.length) {
      events.sort((a, b) => a.at - b.at);
      const event = events.shift(); now = event.at;
      if (event.complete) {
        running--;
        const count = h.published.length; h.complete(event.complete);
        if (h.published.length > count) commits.push({ at: now, id: h.published.at(-1).id, value: h.published.at(-1).params.value });
      } else h.queue.request({ value: event.value }, event.quality ?? 'preview');
      const state = h.queue.diagnostics();
      assert(running <= 1); assert(state.pendingId === null || state.pendingId > state.activeId);
    }
    assert.equal(peak, 1);
    assert(commits.filter(x => x.at < 1000).length >= 40, 'completions must publish during input, not only after release');
    assert(h.sent.length < 60, 'intermediate inputs coalesce into one pending job');
    for (let i = 1; i < commits.length; i++) assert(commits[i].id > commits[i - 1].id);
    assert.equal(h.published.at(-1).mesh.params.value, 12345);
    assert.equal(h.published.at(-1).quality, 'settled');
    assert.equal(h.statuses.at(-1), 'Ready');
    assert.equal(h.queue.diagnostics().pendingId, null);
  });
}

test('older completed progress cannot claim latest readiness', () => {
  const h = harness();
  h.queue.request({ shape: 'old' }, 'settled');
  h.queue.request({ shape: 'new' }, 'preview');
  h.complete(h.sent[0]);
  assert.equal(h.published[0].params.shape, 'old');
  assert.equal(h.statuses.at(-1), 'Shaping…');
  h.complete(h.sent[1]); assert.equal(h.published.at(-1).params.shape, 'new');
  assert.equal(h.statuses.at(-1), 'Live preview');
});

test('late duplicate and unexpected replies never roll back the display or free current work', () => {
  const h = harness();
  h.queue.request({ value: 1 }, 'preview'); h.complete(h.sent[0]);
  h.queue.request({ value: 2 }, 'preview');
  h.complete(h.sent[0]); h.complete({ id: 999, params: {}, quality: 'preview' });
  assert.equal(h.queue.diagnostics().activeId, 2);
  assert.equal(h.published.length, 1);
  h.complete(h.sent[1]); h.complete(h.sent[0]);
  assert.deepEqual(h.published.map(x => x.id), [1, 2]);
});

test('an obsolete shape error drains the newer pending reset/preset', () => {
  const h = harness();
  h.queue.request({ preset: 'old' }, 'preview');
  h.queue.request({ preset: 'reset' }, 'preview');
  h.queue.request({ preset: 'ribbon' }, 'preview');
  h.complete(h.sent[0], { error: 'obsolete error' });
  assert.equal(h.errors.at(-1), '');
  assert.equal(h.sent.length, 2); assert.equal(h.sent[1].params.preset, 'ribbon');
  h.complete(h.sent[1]); assert.equal(h.published.at(-1).params.preset, 'ribbon');
});

test('latest rejection retains the last valid mesh and a later input can recover', () => {
  const h = harness();
  h.queue.request({ value: 1 }, 'preview'); h.complete(h.sent[0]);
  h.queue.request({ value: 2 }, 'settled'); h.complete(h.sent[1], { error: 'Shape invalid' });
  assert.equal(h.errors.at(-1), 'Shape invalid'); assert.equal(h.statuses.at(-1), 'Shape rejected'); assert.equal(h.published.length, 1);
  h.queue.request({ value: 3 }, 'settled'); assert.equal(h.errors.at(-1), ''); h.complete(h.sent[2]);
  assert.equal(h.published.at(-1).params.value, 3); assert.equal(h.statuses.at(-1), 'Ready');
});

test('worker failure clears pending work and stays unavailable rather than pretending to shape', () => {
  const h = harness();
  h.queue.request({ value: 1 }, 'preview'); h.queue.request({ value: 2 }, 'preview');
  h.queue.fail('Worker failed'); h.queue.request({ value: 3 }, 'preview'); h.complete(h.sent[0]);
  assert.equal(h.sent.length, 1); assert.equal(h.published.length, 0); assert.equal(h.statuses.at(-1), 'Unavailable');
  assert.deepEqual(h.queue.diagnostics(), { activeId: null, pendingId: null, latestId: 2, displayedId: 0, stopped: true });
});

test('send failure is terminal and dispose ignores later completions', () => {
  const failed = harness(() => { throw new Error('postMessage failed'); });
  failed.queue.request({}, 'preview'); assert.equal(failed.statuses.at(-1), 'Unavailable');
  const h = harness(); h.queue.request({}, 'preview'); h.queue.request({}, 'settled'); h.queue.dispose(); h.complete(h.sent[0]);
  assert.equal(h.sent.length, 1); assert.equal(h.published.length, 0);
});

test('pending parameters are snapshots and a newer settled request replaces pending preview', () => {
  const h = harness(), params = { width: 2 };
  h.queue.request({ width: 1 }, 'preview'); h.queue.request(params, 'preview'); params.width = 100;
  h.complete(h.sent[0]); assert.equal(h.sent[1].params.width, 2);
  h.queue.request({ width: 3 }, 'preview'); h.queue.request({ width: 3 }, 'settled');
  h.complete(h.sent[1]); assert.equal(h.sent[2].quality, 'settled'); h.complete(h.sent[2]);
  assert.equal(h.published.at(-1).params.width, 3); assert.equal(h.statuses.at(-1), 'Ready');
});

test('family switch discards obsolete completion/error and runs only the latest pending family', () => {
  for (const error of [undefined, 'old family error']) {
    const h = harness();
    h.queue.request({ width: 4.3 }, 'preview', 'wave', 0);
    h.queue.request({ width: 1.6 }, 'preview', 'fixture', 1);
    h.complete(h.sent[0], { error });
    assert.equal(h.published.length, 0); assert.equal(h.errors.at(-1), '');
    assert.equal(h.sent.length, 2); assert.equal(h.sent[1].family, 'fixture');
    h.complete(h.sent[1]); assert.equal(h.published.at(-1).family, 'fixture');
  }
});

test('rapid A -> B -> A switches cannot resurrect the previous A selection', () => {
  const h = harness();
  h.queue.request({ width: 6 }, 'settled', 'wave', 0);
  h.queue.request({ width: 1.6 }, 'preview', 'fixture', 1);
  h.queue.request({ width: 4.3 }, 'preview', 'wave', 2);
  h.complete(h.sent[0]); assert.equal(h.published.length, 0);
  assert.equal(h.sent.length, 2); assert.equal(h.sent[1].selection, 2);
  h.complete(h.sent[1]); assert.equal(h.published[0].params.width, 4.3);
  assert.equal(h.published[0].selection, 2);
});

test('incorrect reply identity fails closed without displaying another family', () => {
  for (const mismatch of [{ family: 'other' }, { selection: 99 }]) {
    const h = harness(); h.queue.request({}, 'preview', 'wave', 0);
    h.complete(h.sent[0], mismatch);
    assert.equal(h.published.length, 0); assert.equal(h.statuses.at(-1), 'Unavailable');
    assert.equal(h.queue.diagnostics().activeId, null);
  }
});
