// Builds the pendant outline + preview mesh off the main thread, so dragging
// the liquidity slider never stalls the page. Requests carry an id; only the
// newest one matters to the page, which keeps at most one in flight.
import { buildPreview } from '@/modules/pendant-build';

self.onmessage = (e: MessageEvent) => {
  const { id, params, meshOpts } = e.data;
  try {
    const t0 = performance.now();
    const { mesh, loops } = buildPreview(params, meshOpts);
    const ms = performance.now() - t0;
    (self as unknown as Worker).postMessage(
      { id, mesh, loops, ms },
      [mesh.vertices.buffer, mesh.normals.buffer, mesh.triangles.buffer],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.message || err) });
  }
};
