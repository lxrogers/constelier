// Builds the pendant outline + preview mesh off the main thread, so dragging
// the liquidity slider never stalls the page. Requests carry an id; only the
// newest one matters to the page, which keeps at most one in flight.
//
// `kind: 'frames'` builds a list of outlines (no mesh) for an animation,
// posting each as soon as it is ready; a newer request or `kind: 'cancel'`
// stops the old list.
import { buildPreview, buildOutlineLoops } from '@/modules/pendant-build';

let framesId = 0;

self.onmessage = (e: MessageEvent) => {
  const post = (msg: unknown, transfer: Transferable[] = []) =>
    (self as unknown as Worker).postMessage(msg, transfer);
  const d = e.data;

  if (d.kind === 'cancel') { framesId = 0; return; }

  if (d.kind === 'frames') {
    framesId = d.id;
    let i = 0;
    const step = () => {
      if (framesId !== d.id || i >= d.paramsList.length) return;
      try {
        post({ id: d.id, index: i, loops: buildOutlineLoops(d.paramsList[i]) });
      } catch (err) {
        post({ id: d.id, index: i, error: String((err as Error)?.message || err) });
      }
      i++;
      // Yield between frames so a cancel or newer list can get in.
      setTimeout(step, 0);
    };
    step();
    return;
  }

  const { id, params, meshOpts } = d;
  try {
    const t0 = performance.now();
    const { mesh, loops } = buildPreview(params, meshOpts);
    const ms = performance.now() - t0;
    post({ id, mesh, loops, ms }, [mesh.vertices.buffer, mesh.normals.buffer, mesh.triangles.buffer]);
  } catch (err) {
    post({ id, error: String((err as Error)?.message || err) });
  }
};
