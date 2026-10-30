/**
 * One active request, one replaceable pending request, monotone publication.
 * A completed result need not equal the latest INPUT to be useful during motion.
 * It must be newer than the displayed result. Readiness/errors are latest-only.
 * Workers and React are supplied by the caller so timing can be tested directly.
 */
export function createMeshQueue({ send, publish, setStatus, setError }) {
  let active = null, pending = null, latestId = 0, displayedId = 0, stopped = false;
  let selectedFamily = null, selectedScope = null;
  const pump = () => {
    if (stopped || active || !pending) return;
    active = pending; pending = null;
    try { send(active); }
    catch { fail('The geometry worker could not accept the shape. Reload to try again.'); }
  };
  function fail(message) {
    if (stopped) return;
    stopped = true; active = null; pending = null;
    setError(message); setStatus('Unavailable');
  }
  return {
    request(params, quality, family = 'wave', selection = 0) {
      if (stopped) return null;
      const id = ++latestId;
      selectedFamily = family; selectedScope = selection;
      pending = { id, params: { ...params }, quality, family, selection };
      setError('');
      setStatus(quality === 'preview' ? 'Shaping…' : 'Checking your ring…');
      pump();
      return id;
    },
    complete(data) {
      // Ignore duplicate/out-of-order replies, including replies after dispose.
      if (stopped || !active || data.id !== active.id) return;
      const finished = active;
      if (data.family !== finished.family || data.selection !== finished.selection) {
        fail('The geometry worker returned a different ring selection. Reload to try again.');
        return;
      }
      active = null;
      // A family can change away and back before the first worker completes.
      // Family ID alone is insufficient: each selection has its own scope.
      if (finished.family !== selectedFamily || finished.selection !== selectedScope) { pump(); return; }
      const current = data.id === latestId;
      if (data.error) {
        // An error for an obsolete input must not reject a newer pending shape.
        if (current) { setError(data.error); setStatus('Shape rejected'); }
      } else if (data.id > displayedId) {
        displayedId = data.id;
        publish(data); setError('');
        // A completed older preview is progress, but is not the final shape.
        setStatus(current ? (data.quality === 'settled' ? 'Ready' : 'Live preview') : (pending?.quality === 'settled' ? 'Checking your ring…' : 'Shaping…'));
      }
      pump();
    },
    fail,
    dispose() { stopped = true; active = null; pending = null; },
    diagnostics() { return { activeId: active?.id ?? null, pendingId: pending?.id ?? null, latestId, displayedId, stopped }; },
  };
}
