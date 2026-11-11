import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { decodeDesignMetadata } from './order-metadata';

// Called from both the webhook and the success page (whichever arrives first),
// as Stripe recommends. Safe to call repeatedly: the PaymentIntent's metadata
// marks the order once it has been handled.
export async function fulfillCheckout(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product', 'payment_intent'],
  });

  // Delayed methods (e.g. bank debits) complete the session before the money lands.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { session, fulfilled: false };
  }
  const pi = session.payment_intent as Stripe.PaymentIntent | null;
  if (pi?.metadata?.fulfilled_at) return { session, fulfilled: true };

  const designs = (session.line_items?.data ?? []).map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    return {
      quantity: li.quantity,
      designId: product?.metadata?.design_id,
      design: product ? decodeDesignMetadata(product.metadata) : null,
    };
  });

  // TODO: write the order to a database, generate the casting STL for each
  // design (see /api/pendant/stl) and send it to production.
  console.log('[order] paid', JSON.stringify({
    session: session.id,
    total: session.amount_total,
    tax: session.total_details?.amount_tax,
    shipping: session.shipping_cost?.amount_subtotal,
    email: session.customer_details?.email ? 'yes' : 'no',
    items: designs.map((d) => ({ designId: d.designId, quantity: d.quantity, chords: d.design?.geometry.chords.length })),
  }));

  if (pi) {
    try {
      await stripe.paymentIntents.update(pi.id, { metadata: { fulfilled_at: new Date().toISOString() } });
    } catch (err) {
      console.error('[order] could not mark fulfilled', session.id, (err as Error).message);
    }
  }
  return { session, fulfilled: true };
}
