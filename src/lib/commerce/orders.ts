import 'server-only';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { eq, isNull, and, inArray, sql } from 'drizzle-orm';
import { atomically, isUniqueViolation, type DbHandle } from '@/lib/db/client';
import { customers, designs, orders, orderItems, orderEvents, type ShippingAddress } from '@/lib/db/schema';
import type { PendantDesign } from './design';
import { decodeDesignMetadata } from './order-metadata';
import { SHIP_WITHIN_DAYS } from './checkout';

// ── Checkout: save designs before payment ───────────────────────────────────

// Called when checkout starts, so the Stripe session only has to carry design
// ids. Saving the same design twice is a no-op.
export async function saveDesigns(handle: DbHandle, items: { id: string; design: PendantDesign }[]) {
  if (items.length === 0) return;
  await handle.db.insert(designs)
    .values(items.map(({ id, design }) => ({ id, spec: design.spec, geometry: design.geometry })))
    .onConflictDoNothing({ target: designs.id });
}

export async function designsWithoutThumbnail(handle: DbHandle, ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await handle.db.select({ id: designs.id }).from(designs)
    .where(and(inArray(designs.id, ids), isNull(designs.thumbnailUrl)));
  return new Set(rows.map((r) => r.id));
}

export async function setDesignThumbnail(handle: DbHandle, id: string, url: string) {
  await handle.db.update(designs).set({ thumbnailUrl: url })
    .where(and(eq(designs.id, id), isNull(designs.thumbnailUrl)));
}

// ── Payment: write the order ────────────────────────────────────────────────

export type RecordResult =
  | { status: 'created'; orderId: string; number: number }
  | { status: 'exists'; orderId: string; number: number }
  | { status: 'skipped'; reason: string };

// Writes the customer, links their designs and writes the order, its items
// and a "created" event, from a paid Checkout Session retrieved with
// `expand: ['line_items.data.price.product', 'payment_intent']`.
// Safe to call any number of times for the same session (webhook retries,
// the success page racing the webhook): only the first call writes anything.
export async function recordPaidOrder(
  handle: DbHandle,
  session: Stripe.Checkout.Session,
  source: 'webhook' | 'success_page' | 'script',
): Promise<RecordResult> {
  const { db } = handle;
  const existing = await findOrderBySession(handle, session.id);
  if (existing) return { status: 'exists', ...existing };

  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return { status: 'skipped', reason: 'session has no customer email' };

  const lines = (session.line_items?.data ?? []).map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    const meta = product?.metadata ?? {};
    return {
      designId: meta.design_id,
      legacyDesign: meta.spec ? decodeDesignMetadata(meta) : null,
      description: li.description ?? product?.name ?? null,
      metal: meta.metal || 'unknown',
      quantity: li.quantity ?? 1,
      unitPrice: li.price?.unit_amount ?? Math.round(li.amount_subtotal / (li.quantity || 1)),
      estGrams: meta.est_grams ? Number(meta.est_grams) : null,
    };
  });
  if (lines.length === 0 || lines.some((l) => !l.designId)) {
    return { status: 'skipped', reason: 'a line item has no design_id' };
  }

  // Orders started before the database existed carry the whole design in
  // Stripe metadata. Save those so every order item has its design row.
  const legacy = lines.filter((l) => l.legacyDesign).map((l) => ({ id: l.designId!, design: l.legacyDesign! }));
  await saveDesigns(handle, legacy);
  const designIds = [...new Set(lines.map((l) => l.designId!))];
  const found = await db.select({ id: designs.id }).from(designs).where(inArray(designs.id, designIds));
  if (found.length !== designIds.length) {
    // Retryable: thrown so the webhook answers 500 and Stripe tries again.
    throw new Error(`order ${session.id}: design rows missing for ${designIds.filter((id) => !found.some((f) => f.id === id)).join(', ')}`);
  }

  const name = session.customer_details?.name ?? null;
  const phone = session.customer_details?.phone ?? null;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  const [customer] = await db.insert(customers)
    .values({ email, name, phone, stripeCustomerId })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: sql`coalesce(excluded.name, ${customers.name})`,
        phone: sql`coalesce(excluded.phone, ${customers.phone})`,
        stripeCustomerId: sql`coalesce(excluded.stripe_customer_id, ${customers.stripeCustomerId})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: customers.id });

  const orderId = randomUUID();
  const pi = session.payment_intent;
  const created = new Date((session.created ?? Date.now() / 1000) * 1000);
  const shipBy = new Date(created.getTime() + SHIP_WITHIN_DAYS * 86_400_000).toISOString().slice(0, 10);

  try {
    await atomically(handle, (q) => [
      q.insert(orders).values({
        id: orderId,
        customerId: customer.id,
        stripeSessionId: session.id,
        stripePaymentIntentId: typeof pi === 'string' ? pi : pi?.id ?? null,
        status: 'paid',
        currency: session.currency ?? 'usd',
        subtotal: session.amount_subtotal ?? 0,
        discount: session.total_details?.amount_discount ?? 0,
        shipping: session.shipping_cost?.amount_subtotal ?? 0,
        tax: session.total_details?.amount_tax ?? 0,
        total: session.amount_total ?? 0,
        shippingAddress: shippingAddressOf(session),
        promisedShipBy: shipBy,
      }),
      q.insert(orderItems).values(lines.map((l) => ({
        orderId,
        designId: l.designId!,
        description: l.description,
        metal: l.metal,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        estGrams: l.estGrams,
      }))),
      q.insert(orderEvents).values({
        orderId,
        type: 'created',
        toStatus: 'paid',
        data: { source, stripeSessionId: session.id },
      }),
      q.update(designs).set({ customerId: customer.id })
        .where(and(inArray(designs.id, designIds), isNull(designs.customerId))),
    ]);
  } catch (err) {
    // Lost a race with another call for the same session: that one wrote it.
    if (isUniqueViolation(err)) {
      const winner = await findOrderBySession(handle, session.id);
      if (winner) return { status: 'exists', ...winner };
    }
    throw err;
  }

  const [row] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, orderId));
  return { status: 'created', orderId, number: row.number };
}

async function findOrderBySession(handle: DbHandle, sessionId: string) {
  const [row] = await handle.db.select({ orderId: orders.id, number: orders.number })
    .from(orders).where(eq(orders.stripeSessionId, sessionId));
  return row ?? null;
}

function shippingAddressOf(session: Stripe.Checkout.Session): ShippingAddress | null {
  const details = session.collected_information?.shipping_details
    ?? (session as unknown as { shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails }).shipping_details;
  const a = details?.address;
  if (!details || !a) return null;
  return {
    name: details.name ?? null,
    line1: a.line1 ?? null,
    line2: a.line2 ?? null,
    city: a.city ?? null,
    state: a.state ?? null,
    postalCode: a.postal_code ?? null,
    country: a.country ?? null,
  };
}

export function formatOrderNumber(n: number) {
  return `C${n}`;
}
