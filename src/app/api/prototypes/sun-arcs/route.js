import { join } from 'path';
import { initOpenCascade } from '@/modules/replicad-pipeline';
import { buildSunArcs } from '@/modules/prototypes/sun-arcs';
import { normalize } from '@/modules/prototypes/sun-arcs-params';
export const runtime = 'nodejs';
export const maxDuration = 60;
// Serialize prototype jobs to bound kernel memory pressure.
let queue = Promise.resolve();
export async function POST(request) {
  let input;
  try { input = await request.json(); normalize(input); } catch { return Response.json({ error: 'Parameters must be finite numbers.' }, { status: 400 }); }
  const task = queue.then(async () => {
    await initOpenCascade(join(process.cwd(), 'public/wasm/replicad_single.wasm'));
    let result;
    try {
      result = buildSunArcs(input);
      if (input.export === 'stl') return new Response(await result.shape.blobSTL({ binary: true }), { headers: { 'Content-Type': 'model/stl', 'Content-Disposition': 'attachment; filename="sun-arcs.stl"' } });
      const mesh = result.shape.mesh({ tolerance: 0.05, angularTolerance: 0.15 });
      return Response.json({ vertices: Array.from(mesh.vertices), normals: Array.from(mesh.normals), triangles: Array.from(mesh.triangles),  params: result.params });
    } finally { result?.shape.delete(); }
  });
  queue = task.catch(() => {});
  try { return await task; } catch (error) { console.error(error); return Response.json({ error: `Geometry failed: ${error.message}` }, { status: 422 }); }
}
