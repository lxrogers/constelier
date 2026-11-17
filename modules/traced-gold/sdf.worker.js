// Builds a pendant's distance map off the main thread, so a new pendant
// arriving does not stall whatever is animating on the page.
import { buildPendantSdf } from './pendant-sdf.js';

self.onmessage = (e) => {
  const { id, vertices, triangles, extent, size } = e.data;
  try {
    const sdf = buildPendantSdf(vertices, triangles, extent, size);
    self.postMessage({ id, data: sdf.data, size: sdf.size, extent: sdf.extent }, [sdf.data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
