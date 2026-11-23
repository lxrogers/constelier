import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DbHandle } from '@/lib/db/client';
import {
  customers, designs, messages, offers, orders, quoteRequests,
  type Customer, type QuoteStatus,
} from '@/lib/db/schema';
import type { PendantDesign } from '@/lib/commerce/design';
import { designId } from '@/lib/commerce/order-metadata';
import { saveDesigns } from '@/lib/commerce/orders';

export const QUOTE_STATUSES: { id: QuoteStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'offer_sent', label: 'Offer sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'closed', label: 'Closed' },
];

export interface QuoteRequestInput {
  firstName: string;
  channel: 'email' | 'sms';
  // Already normalized (see contact.ts): exactly one of these is set.
  email: string | null;
  phone: string | null;
  design: PendantDesign | null;
}

// Finds the customer with this email or phone, or adds one. The name and the
// missing contact detail are filled in, never overwritten.
export async function findOrCreateCustomer(
  handle: DbHandle,
  who: { email: string | null; phone: string | null; name?: string | null; smsOptIn?: boolean },
): Promise<Customer> {
  const { db } = handle;
  const byEmail = who.email
    ? (await db.select().from(customers).where(eq(customers.email, who.email)))[0]
    : undefined;
  const found = byEmail ?? (who.phone
    ? (await db.select().from(customers).where(eq(customers.phone, who.phone)).orderBy(customers.createdAt))[0]
    : undefined);
  if (found) {
    const [updated] = await db.update(customers).set({
      name: found.name ?? who.name ?? null,
      phone: found.phone ?? who.phone,
      // Only when this person has no address yet and nobody else has it.
      email: found.email ?? (byEmail ? found.email : who.email),
      smsOptIn: found.smsOptIn || Boolean(who.smsOptIn),
      updatedAt: sql`now()`,
    }).where(eq(customers.id, found.id)).returning();
    return updated;
  }
  const [created] = await db.insert(customers).values({
    email: who.email, phone: who.phone, name: who.name ?? null, smsOptIn: Boolean(who.smsOptIn),
  }).returning();
  return created;
}

// What the quote form does: the customer, their design and one request row.
export async function createQuoteRequest(handle: DbHandle, input: QuoteRequestInput) {
  const { db } = handle;
  const customer = await findOrCreateCustomer(handle, {
    email: input.email,
    phone: input.phone,
    name: input.firstName || null,
    // Choosing "Text me" is asking to be texted about this quote.
    smsOptIn: input.channel === 'sms',
  });
  let savedDesignId: string | null = null;
  if (input.design) {
    savedDesignId = designId(input.design);
    await saveDesigns(handle, [{ id: savedDesignId, design: input.design }]);
    await db.update(designs).set({ customerId: customer.id })
      .where(and(eq(designs.id, savedDesignId), isNull(designs.customerId)));
  }
  const [request] = await db.insert(quoteRequests)
    .values({ customerId: customer.id, designId: savedDesignId, channel: input.channel })
    .returning();
  return { request, customer, designId: savedDesignId };
}

// The admin list: newest first, with the customer, the design and the latest
// message on each.
export async function listQuoteRequests(handle: DbHandle, status?: QuoteStatus) {
  const { db } = handle;
  const rows = await db.select({
    request: quoteRequests,
    customer: customers,
    spec: designs.spec,
    thumbnailUrl: designs.thumbnailUrl,
  })
    .from(quoteRequests)
    .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
    .leftJoin(designs, eq(designs.id, quoteRequests.designId))
    .where(status ? eq(quoteRequests.status, status) : undefined)
    .orderBy(desc(quoteRequests.createdAt))
    .limit(200);
  const customerIds = [...new Set(rows.map((r) => r.customer.id))];
  const latest = customerIds.length
    ? await db.selectDistinctOn([messages.customerId], {
      customerId: messages.customerId, direction: messages.direction, body: messages.body, createdAt: messages.createdAt,
    }).from(messages).where(inArray(messages.customerId, customerIds))
      .orderBy(messages.customerId, desc(messages.createdAt))
    : [];
  const byCustomer = new Map(latest.map((m) => [m.customerId, m]));
  return rows.map((r) => ({ ...r, lastMessage: byCustomer.get(r.customer.id) ?? null }));
}

export async function countByStatus(handle: DbHandle) {
  const rows = await handle.db.select({ status: quoteRequests.status, n: sql<number>`count(*)::int` })
    .from(quoteRequests).groupBy(quoteRequests.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<QuoteStatus, number>>;
}

// Everything the request page shows.
export async function getQuoteRequest(handle: DbHandle, id: string) {
  const { db } = handle;
  const [row] = await db.select({ request: quoteRequests, customer: customers })
    .from(quoteRequests)
    .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
    .where(eq(quoteRequests.id, id));
  if (!row) return null;
  const [design] = row.request.designId
    ? await db.select().from(designs).where(eq(designs.id, row.request.designId))
    : [];
  const [offer] = await db.select().from(offers)
    .where(eq(offers.quoteRequestId, id)).orderBy(desc(offers.createdAt)).limit(1);
  const thread = await db.select().from(messages)
    .where(eq(messages.customerId, row.customer.id)).orderBy(messages.createdAt);
  const paid = await db.select().from(orders)
    .where(eq(orders.customerId, row.customer.id)).orderBy(desc(orders.createdAt));
  return { ...row, design: design ?? null, offer: offer ?? null, thread, orders: paid };
}

export async function setQuoteStatus(handle: DbHandle, id: string, status: QuoteStatus) {
  await handle.db.update(quoteRequests).set({ status, updatedAt: sql`now()` }).where(eq(quoteRequests.id, id));
}

// Moves a request forward, never back: sending a first message to a "new"
// request makes it "contacted", but leaves a "paid" one alone.
export async function advanceQuoteStatus(handle: DbHandle, id: string, to: QuoteStatus) {
  const order = QUOTE_STATUSES.map((s) => s.id);
  const earlier = order.slice(0, order.indexOf(to));
  if (earlier.length === 0) return;
  await handle.db.update(quoteRequests).set({ status: to, updatedAt: sql`now()` })
    .where(and(eq(quoteRequests.id, id), inArray(quoteRequests.status, earlier)));
}

export async function setQuoteNotes(handle: DbHandle, id: string, notes: string) {
  await handle.db.update(quoteRequests).set({ notes: notes.trim() || null, updatedAt: sql`now()` })
    .where(eq(quoteRequests.id, id));
}
