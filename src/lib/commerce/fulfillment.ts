import 'server-only';
import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { decodeDesignMetadata } from './order-metadata';
import { recordPaidOrder, type RecordResult } from './orders';
import { getDb } from '@/lib/db/client';

// Called from both the webhook and the success page (whichever arrives first),
// as Stripe recommends. Safe to call repeatedly.
//
// With a database, the order is written there and the orders table's unique
// Stripe session id makes repeats a no-op. Without one, the order is only
// logged and the PaymentIntent's metadata marks it as handled.
//
// `onRecordError: 'throw'` (the webhook) lets a failed write surface as a 500
// so Stripe retries; the success page logs it and still shows the receipt.
export async function fulfillCheckout(
  sessionId: string,
  { source, onRecordError }: { source: 'webhook' | 'success_page'; onRecordError: 'throw' | 'log' },
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product', 'payment_intent'],
  });

  // Delayed methods (e.g. bank debits) complete the session before the money lands.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { session, fulfilled: false, order: null };
  }

  const dbReady = getDb();
  if (dbReady) {
    let order: RecordResult | null = null;
    try {
      order = await recordPaidOrder(await dbReady, session, source);
      if (order.status === 'created') console.log('[order] saved', session.id, 'as', order.number);
      if (order.status === 'skipped') console.error('[order] not saved', session.id, order.reason);
    } catch (err) {
      console.error('[order] could not save', session.id, (err as Error).message);
      if (onRecordError === 'throw') throw err;
    }
    return { session, fulfilled: true, order };
  }

  const pi = session.payment_intent as Stripe.PaymentIntent | null;
  if (pi?.metadata?.fulfilled_at) return { session, fulfilled: true, order: null };

  const designs = (session.line_items?.data ?? []).map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    return {
      quantity: li.quantity,
      designId: product?.metadata?.design_id,
      design: product ? decodeDesignMetadata(product.metadata) : null,
    };
  });
  console.log('[order] paid (no database configured)', JSON.stringify({
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
  return { session, fulfilled: true, order: null };
}
