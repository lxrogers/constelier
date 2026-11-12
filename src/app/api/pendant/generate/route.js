import { NextResponse } from 'next/server';
import { buildExportMesh, meshOptionsFor, OUTLINE_STYLE_IDS } from '@/modules/pendant-build.js';

// Mesh-only build (no OpenCascade): rolling-ball rounding of the top and
// bottom edges, a few tens of ms for any outline style.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const params = await request.json();
    const {
      chords, expansion, circleRadius, borderThickness,
      minArea = 10, minAngle = 15, filletRadius = 2,
      thickness = 5, filletRadius3D = 2, rimRoundness,
      outlineStyle = 'current', liquidity,
    } = params;

    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return NextResponse.json({ error: 'chords array is required' }, { status: 400 });
    }
    if (typeof expansion !== 'number' || typeof circleRadius !== 'number' || typeof borderThickness !== 'number') {
      return NextResponse.json({ error: 'expansion, circleRadius, and borderThickness are required numbers' }, { status: 400 });
    }
    if (!OUTLINE_STYLE_IDS.includes(outlineStyle)) {
      return NextResponse.json({ error: 'outlineStyle must be one of ' + OUTLINE_STYLE_IDS.join(', ') }, { status: 400 });
    }

    const mesh = buildExportMesh(
      { style: outlineStyle, chords, circleRadius, borderThickness, expansion, minArea, minAngle, filletRadius, liquidity },
      meshOptionsFor({ thickness, edgeFillet: filletRadius3D, rimRoundness }),
    );
    const normals = vertexNormals(mesh.vertices, mesh.triangles);

    return NextResponse.json({
      vertices: Array.from(mesh.vertices),
      normals: Array.from(normals),
      triangles: Array.from(mesh.triangles),
      edgeLines: [],
      cutOk: true,
      cutFail: 0,
      filletInfo: 'mesh r=' + mesh.filletR.toFixed(2),
    });
  } catch (err) {
    console.error('Pendant generation error:', err);
    return NextResponse.json({ error: 'Generation failed: ' + (err.message || err) }, { status: 500 });
  }
}

// Area-weighted vertex normals for the welded export mesh.
function vertexNormals(V, T) {
  const N = new Float32Array(V.length);
  for (let t = 0; t < T.length; t += 3) {
    const a = 3 * T[t], b = 3 * T[t + 1], c = 3 * T[t + 2];
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    N[i] /= l; N[i + 1] /= l; N[i + 2] /= l;
  }
  return N;
}
