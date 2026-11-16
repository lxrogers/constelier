import { renderApiConfigured, renderApiEnabled, renderApiFetch, renderApiUnavailable } from '@/lib/render-api';

// Starts a photo render of a pendant on the Modal render API.
//   GET  -> { available }               can this machine start renders?
//   POST ?scene=wall|stone&quality=draft|standard|high, body: binary STL
//        -> { id, ... }                 poll /api/lab/render/<id> for the image

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ available: renderApiEnabled && renderApiConfigured, configured: renderApiConfigured });
}

export async function POST(request: Request) {
  const unavailable = renderApiUnavailable();
  if (unavailable) return unavailable;
  const q = new URL(request.url).searchParams;
  const scene = q.get('scene') || 'wall';
  const quality = q.get('quality') || 'draft';
  const stl = await request.arrayBuffer();
  if (stl.byteLength < 84) return Response.json({ error: 'Body must be a binary STL' }, { status: 400 });
  try {
    const res = await renderApiFetch(`/renders?scene=${encodeURIComponent(scene)}&quality=${encodeURIComponent(quality)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: stl,
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) || `Render API answered ${res.status}` }; }
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json({ error: 'Could not reach the render API: ' + (e as Error).message }, { status: 502 });
  }
}
