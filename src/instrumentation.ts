import type { Instrumentation } from 'next';

// Next calls this for every uncaught error in a route handler, server
// component or server action. Query strings are dropped: the chart page keeps
// birth details in its URL.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { sendAlert } = await import('@/lib/alerts');
  const e = err as Error & { digest?: string };
  const path = request.path.split('?')[0];
  await sendAlert({
    title: `Server error on ${request.method} ${path}`,
    detail: [
      `${e.name}: ${e.message}`,
      e.digest ? `digest ${e.digest}` : '',
      `${context.routeType} ${context.routePath}`,
    ].filter(Boolean).join('\n'),
    key: `server:${context.routePath}:${e.message}`,
  });
};
