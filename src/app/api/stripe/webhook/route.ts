import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import { fulfillCheckout } from '@/lib/commerce/fulfillment';

// Stripe → us. Register this URL in the Stripe dashboard (Developers →
// Webhooks) for checkout.session.completed and
// checkout.session.async_payment_succeeded, and put its signing secret in
// STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('webhook secret not configured', { status: 500 });

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.warn('Stripe webhook signature check failed:', (err as Error).message);
    return new Response('bad signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await fulfillCheckout((event.data.object as Stripe.Checkout.Session).id);
      break;
    case 'checkout.session.async_payment_failed':
      console.warn('[order] payment failed', (event.data.object as Stripe.Checkout.Session).id);
      break;
  }
  return Response.json({ received: true });
}
