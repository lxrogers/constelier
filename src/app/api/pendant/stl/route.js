import { buildExportMesh, meshOptionsFor, OUTLINE_STYLE_IDS } from '@/modules/pendant-build.js';
import { meshToSTL } from '@/modules/fast-pendant-mesh.js';

// Casting export without OpenCascade: same body as /api/pendant/generate,
// returns a watertight binary STL with the edges rounded to filletRadius3D.
export async function POST(request) {
  try {
    const {
      chords, expansion, circleRadius, borderThickness,
      minArea = 10, minAngle = 15, filletRadius = 2,
      thickness = 5, filletRadius3D = 2, rimRoundness, scale = 1,
      outlineStyle = 'current', liquidity,
    } = await request.json();

    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return Response.json({ error: 'chords array is required' }, { status: 400 });
    }
    if (typeof expansion !== 'number' || typeof circleRadius !== 'number' || typeof borderThickness !== 'number') {
      return Response.json({ error: 'expansion, circleRadius, and borderThickness are required numbers' }, { status: 400 });
    }
    if (!OUTLINE_STYLE_IDS.includes(outlineStyle)) {
      return Response.json({ error: 'outlineStyle must be one of ' + OUTLINE_STYLE_IDS.join(', ') }, { status: 400 });
    }

    const mesh = buildExportMesh(
      { style: outlineStyle, chords, circleRadius, borderThickness, expansion, minArea, minAngle, filletRadius, liquidity },
      meshOptionsFor({ thickness, edgeFillet: filletRadius3D, rimRoundness }),
    );

    return new Response(meshToSTL(mesh, { scale }), {
      headers: {
        'Content-Type': 'model/stl',
        'Content-Disposition': `attachment; filename="constelier-${outlineStyle}.stl"`,
        'X-Rounding-Radius': mesh.filletR.toFixed(2),
      },
    });
  } catch (err) {
    console.error('STL export error:', err);
    return Response.json({ error: 'STL export failed: ' + (err.message || err) }, { status: 500 });
  }
}
