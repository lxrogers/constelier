import 'server-only';
import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set (add it to .env.local)');
  client = new Stripe(key);
  return client;
}

// True when the configured key is a live one, so charges are real.
export function stripeLiveMode() {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '');
}

export function siteUrl(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}
