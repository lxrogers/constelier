import { sendAlert } from '@/lib/alerts';
import { stripQuery } from '@/lib/analytics';

// The error pages post here when a page crashes in the browser.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== 'string') return new Response(null, { status: 400 });
  const message = body.message.slice(0, 300);
  const path = typeof body.url === 'string' ? stripQuery(new URL(body.url, 'http://x').pathname) : 'unknown';
  await sendAlert({
    title: `Browser error on ${path}`,
    detail: [
      message,
      typeof body.digest === 'string' ? `digest ${body.digest.slice(0, 40)}` : '',
      typeof body.stack === 'string' ? body.stack.slice(0, 800) : '',
    ].filter(Boolean).join('\n'),
    key: `client:${path}:${message}`,
  });
  return new Response(null, { status: 204 });
}
