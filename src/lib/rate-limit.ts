// A small in-memory limiter for public forms and the admin sign-in. It counts
// per server instance, so it slows a flood down rather than stopping one that
// is spread across instances.
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function clientIp(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}
