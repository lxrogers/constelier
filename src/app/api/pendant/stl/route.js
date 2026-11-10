import { buildPendantModel, serializeChainsFor3D } from '@/modules/pendant-geometry.js';
import { buildPendantMesh, meshToSTL } from '@/modules/fast-pendant-mesh.js';

// Casting export without OpenCascade: same body as /api/pendant/generate,
// returns a watertight binary STL with the edges rounded to filletRadius3D.
export async function POST(request) {
  try {
    const {
      chords, expansion, circleRadius, borderThickness,
      minArea = 10, minAngle = 15, filletRadius = 2,
      thickness = 5, filletRadius3D = 2, scale = 1,
    } = await request.json();

    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return Response.json({ error: 'chords array is required' }, { status: 400 });
    }
    if (typeof expansion !== 'number' || typeof circleRadius !== 'number' || typeof borderThickness !== 'number') {
      return Response.json({ error: 'expansion, circleRadius, and borderThickness are required numbers' }, { status: 400 });
    }

    const model = buildPendantModel(chords, expansion, circleRadius, borderThickness, minArea, minAngle, filletRadius);
    const data = serializeChainsFor3D(model, circleRadius, borderThickness);
    const mesh = buildPendantMesh(data, { thickness, filletR: filletRadius3D });

    return new Response(meshToSTL(mesh, { scale }), {
      headers: {
        'Content-Type': 'model/stl',
        'Content-Disposition': 'attachment; filename="constelier-pendant.stl"',
        'X-Rounding-Radius': mesh.filletR.toFixed(2),
      },
    });
  } catch (err) {
    console.error('STL export error:', err);
    return Response.json({ error: 'STL export failed: ' + (err.message || err) }, { status: 500 });
  }
}
