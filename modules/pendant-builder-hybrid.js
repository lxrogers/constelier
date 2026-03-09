// Hybrid pendant builder: tries server-side generation first, falls back to client-side.
// Returns either { meshData, source: 'server' } or { shape, source: 'client' }.

// Fire the server request early (before expansion animation finishes) via prefetchPendant().
// Then await the result in start3DTransition() via awaitPendantResult().

let _pendingServerRequest = null;

export function prefetchPendant(chords, circleRadius, borderThickness, expansion, options = {}) {
  const { thickness = 5, filletR = 2, minArea = 10, minAngle = 15, filletRadius = 2, meshQuality = 'high' } = options;

  const body = JSON.stringify({
    chords,
    expansion,
    circleRadius,
    borderThickness,
    minArea,
    minAngle,
    filletRadius,
    thickness,
    filletRadius3D: filletR,
    meshQuality,
  });

  _pendingServerRequest = fetch('/api/pendant/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(20000),
  })
    .then(resp => {
      if (!resp.ok) throw new Error('Server returned ' + resp.status);
      return resp.json();
    })
    .then(meshData => ({ meshData, source: 'server' }))
    .catch(err => {
      console.warn('Server pendant generation failed, will fall back to client:', err.message || err);
      return null; // signal fallback needed
    });

  return _pendingServerRequest;
}

export function cancelPrefetch() {
  _pendingServerRequest = null;
}

export async function awaitPendantResult(makerModel, circleRadius, borderThickness, options = {}) {
  const { thickness = 5, filletR = 2 } = options;

  // Check if we have a pending server request
  if (_pendingServerRequest) {
    const serverResult = await _pendingServerRequest;
    _pendingServerRequest = null;
    if (serverResult) return serverResult;
  }

  // Fallback: client-side (lazy-loads WASM on first use)
  const { buildPendant3DFromModel } = await import('./pendant-builder.js');
  const result = await buildPendant3DFromModel(makerModel, circleRadius, borderThickness, { thickness, filletR });
  return { shape: result.shape, source: 'client' };
}

export async function buildRingHybrid(circleRadius, borderThickness, options = {}) {
  // Ring is simple/fast — always build client-side to avoid latency overhead
  const { buildRing3DShape } = await import('./pendant-builder.js');
  return await buildRing3DShape(circleRadius, borderThickness, options);
}
