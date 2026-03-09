import { join } from 'path';
import { NextResponse } from 'next/server';
import { buildPendantModel, serializeChainsFor3D } from '@/modules/pendant-geometry.js';
import { initOpenCascade, buildPendant3D, filletShape } from '@/modules/replicad-pipeline.js';
import { MESH_QUALITY_PRESETS } from '@/modules/mesh-presets.js';

export const maxDuration = 60;

// Eagerly start WASM init on module load — persists across warm invocations
const wasmPath = join(process.cwd(), 'public', 'wasm', 'replicad_single.wasm');
initOpenCascade(wasmPath);

export async function POST(request) {
  try {
    const params = await request.json();

    const {
      chords,
      expansion,
      circleRadius,
      borderThickness,
      minArea = 10,
      minAngle = 15,
      filletRadius = 2,
      thickness = 5,
      filletRadius3D = 2,
      meshQuality = 'medium',
    } = params;

    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return NextResponse.json({ error: 'chords array is required' }, { status: 400 });
    }
    if (typeof expansion !== 'number' || typeof circleRadius !== 'number' || typeof borderThickness !== 'number') {
      return NextResponse.json({ error: 'expansion, circleRadius, and borderThickness are required numbers' }, { status: 400 });
    }

    // Ensure WASM is ready
    await initOpenCascade(wasmPath);

    // Step 1: Build 2D geometry (MakerJS)
    const model = buildPendantModel(chords, expansion, circleRadius, borderThickness, minArea, minAngle, filletRadius);

    // Step 2: Serialize for 3D
    const serialized = serializeChainsFor3D(model, circleRadius, borderThickness);

    // Step 3: Build 3D shape (Replicad/OpenCascade)
    const result = buildPendant3D(serialized, thickness);

    // Step 4: Apply 3D fillets
    let filletInfo = '';
    if (filletRadius3D > 0) {
      const filleted = filletShape(result.shape, thickness, filletRadius3D);
      result.shape = filleted.shape;
      filletInfo = filleted.filletInfo;
    }

    // Step 5: Tessellate to mesh arrays
    const preset = MESH_QUALITY_PRESETS[meshQuality] || MESH_QUALITY_PRESETS.medium;
    const facesData = result.shape.mesh(preset);
    const edgesData = result.shape.meshEdges(preset);

    return NextResponse.json({
      vertices: Array.from(facesData.vertices),
      normals: Array.from(facesData.normals),
      triangles: Array.from(facesData.triangles),
      edgeLines: Array.from(edgesData.lines),
      cutOk: result.cutOk,
      cutFail: result.cutFail,
      filletInfo,
    });
  } catch (err) {
    console.error('Pendant generation error:', err);
    return NextResponse.json({ error: 'Generation failed: ' + (err.message || err) }, { status: 500 });
  }
}
