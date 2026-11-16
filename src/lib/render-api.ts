// Server-side access to the Blender render API on Modal. The proxy auth
// token stays here; the browser only ever talks to /api/lab/render.

const URL_ = process.env.RENDER_API_URL?.replace(/\/$/, '');
const KEY = process.env.RENDER_API_KEY;
const SECRET = process.env.RENDER_API_SECRET;

// Renders cost compute, so the lab can only start them on a dev machine.
export const renderApiEnabled = process.env.NODE_ENV !== 'production';
export const renderApiConfigured = !!(URL_ && KEY && SECRET);

export function renderApiUnavailable(): Response | null {
  if (!renderApiEnabled) return Response.json({ error: 'Renders only run in local dev (npm run dev).' }, { status: 403 });
  if (!renderApiConfigured) {
    return Response.json({ error: 'Set RENDER_API_URL, RENDER_API_KEY and RENDER_API_SECRET in .env.local, then restart the dev server.' }, { status: 503 });
  }
  return null;
}

export function renderApiFetch(path: string, init: RequestInit = {}) {
  return fetch(URL_ + path, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), 'Modal-Key': KEY!, 'Modal-Secret': SECRET! },
    cache: 'no-store',
  });
}
