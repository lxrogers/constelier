import { renderApiFetch, renderApiUnavailable } from '@/lib/render-api';

// A render's result: 202 { status: 'rendering' } until it exists, then the
// PNG itself, or the API's error. Finished images never change, so the
// browser may cache them.

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = renderApiUnavailable();
  if (unavailable) return unavailable;
  const { id } = await params;
  if (!/^[\w-]{4,80}$/.test(id)) return Response.json({ error: 'Bad render id' }, { status: 400 });
  try {
    const res = await renderApiFetch(`/renders/${id}`);
    if (res.status === 200 && res.headers.get('content-type')?.startsWith('image/')) {
      return new Response(res.body, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=604800, immutable' },
      });
    }
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) || `Render API answered ${res.status}` }; }
    return Response.json(data, { status: res.status });
  } catch (e) {
    return Response.json({ error: 'Could not reach the render API: ' + (e as Error).message }, { status: 502 });
  }
}
