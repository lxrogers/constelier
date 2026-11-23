import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import type { DbHandle } from '@/lib/db/client';
import { customers, messages, quoteRequests, type Customer } from '@/lib/db/schema';
import { adminUrl, reachableDbs, siteOrigin, thisEnv, type AdminEnv } from '@/lib/admin/env';
import { normalizeEmail, normalizePhone } from '@/lib/quotes/contact';
import { advanceQuoteStatus } from '@/lib/quotes/requests';
import { sendAlert } from '@/lib/alerts';
import {
  emailConfigured, replyAddress, sendEmail, sendSms, smsConfigured, type Sent,
} from './providers';

// Sending to a customer and filing what comes back. Every message, either
// way, is one row in `messages` on that customer's thread.

export type Channel = 'email' | 'sms';

// Outside production, messages only go to addresses and numbers listed in
// MESSAGE_ALLOWLIST (comma-separated), so a test never reaches a stranger.
function allowedOutsideProduction(to: string) {
  const list = (process.env.MESSAGE_ALLOWLIST ?? '').split(',')
    .map((v) => normalizeEmail(v) ?? normalizePhone(v)).filter(Boolean);
  return list.includes(to);
}

export function channelReady(channel: Channel) {
  return channel === 'email' ? emailConfigured() : smsConfigured();
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendToCustomer(opts: {
  env: AdminEnv;
  handle: DbHandle;
  customer: Customer;
  quoteRequestId: string | null;
  channel: Channel;
  subject: string;
  body: string;
  request?: Request | null;
}): Promise<SendResult> {
  const { env, handle, customer, channel } = opts;
  const body = opts.body.trim();
  if (!body) return { ok: false, error: 'Write a message first.' };
  const to = channel === 'email' ? customer.email : customer.phone;
  if (!to) return { ok: false, error: channel === 'email' ? 'This customer has no email address.' : 'This customer has no phone number.' };
  if (!channelReady(channel)) {
    return { ok: false, error: channel === 'email' ? 'Email is not set up yet (see docs/quotes-admin.md).' : 'Texting is not set up yet (see docs/quotes-admin.md).' };
  }
  if (env !== 'production' && !allowedOutsideProduction(to)) {
    return { ok: false, error: `Not sent: outside production, messages only go to the allowlist, and ${to} is not on it.` };
  }

  const subject = opts.subject.trim() || 'Your Constelier pendant';
  let sent: Sent;
  try {
    sent = channel === 'email'
      ? await sendEmail({ to, subject, body, replyTo: replyAddress(customer.id) })
      : await sendSms({
        to, body,
        // Twilio must be able to reach this, so only from a public site.
        statusCallback: process.env.VERCEL ? `${siteOrigin(thisEnv())}/api/messaging/twilio/status` : null,
      });
  } catch (err) {
    return { ok: false, error: `Not sent: ${(err as Error).message}` };
  }

  await handle.db.insert(messages).values({
    customerId: customer.id,
    quoteRequestId: opts.quoteRequestId,
    direction: 'out',
    channel,
    from: sent.from,
    to,
    subject: channel === 'email' ? subject : null,
    body,
    providerId: sent.providerId,
    deliveryStatus: sent.status,
    sentAt: sql`now()`,
  });
  if (opts.quoteRequestId) {
    await advanceQuoteStatus(handle, opts.quoteRequestId, body.includes('/pendant/ofr_') ? 'offer_sent' : 'contacted');
  }
  return { ok: true };
}

// ── Incoming ────────────────────────────────────────────────────────────────

type Found = { env: AdminEnv; handle: DbHandle; customer: Customer };

// Looks in this deployment's own database first, then any other it can reach
// (production can see staging), so a reply lands where the conversation is.
async function findCustomer(where: { id?: string | null; email?: string | null; phone?: string | null }): Promise<Found | null> {
  for (const { env, db } of reachableDbs()) {
    const handle = await db;
    const byId = where.id ? (await handle.db.select().from(customers).where(eq(customers.id, where.id)))[0] : undefined;
    const byEmail = !byId && where.email ? (await handle.db.select().from(customers).where(eq(customers.email, where.email)))[0] : undefined;
    const byPhone = !byId && !byEmail && where.phone
      ? (await handle.db.select().from(customers).where(eq(customers.phone, where.phone)).orderBy(customers.createdAt))[0]
      : undefined;
    const customer = byId ?? byEmail ?? byPhone;
    if (customer) return { env, handle, customer };
  }
  return null;
}

async function fileIncoming(found: Found, msg: {
  channel: Channel; from: string; to: string; subject: string | null; body: string;
  mediaUrls?: string[]; providerId?: string | null;
}, request: Request) {
  const { env, handle, customer } = found;
  const [latest] = await handle.db.select({ id: quoteRequests.id }).from(quoteRequests)
    .where(eq(quoteRequests.customerId, customer.id)).orderBy(desc(quoteRequests.createdAt)).limit(1);
  await handle.db.insert(messages).values({
    customerId: customer.id,
    quoteRequestId: latest?.id ?? null,
    direction: 'in',
    channel: msg.channel,
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    body: msg.body.slice(0, 20_000),
    mediaUrls: msg.mediaUrls?.length ? msg.mediaUrls : null,
    providerId: msg.providerId ?? null,
    deliveryStatus: 'received',
  });
  await sendAlert({
    level: 'info',
    title: `New ${msg.channel === 'email' ? 'email' : 'text'} from ${customer.name ?? msg.from}`,
    detail: latest ? adminUrl(env, `/requests/${latest.id}`, request) : undefined,
    key: `in:${msg.providerId ?? Date.now()}`,
  });
}

export async function receiveSms(msg: { from: string; to: string; body: string; sid: string; mediaUrls: string[] }, request: Request) {
  const phone = normalizePhone(msg.from) ?? msg.from;
  let found = await findCustomer({ phone });
  if (!found) {
    // A text from a number we have never seen still deserves an answer.
    const own = reachableDbs()[0];
    if (!own) return;
    const handle = await own.db;
    const [customer] = await handle.db.insert(customers).values({ phone }).returning();
    found = { env: own.env, handle, customer };
  }
  // Carriers honour STOP themselves; this keeps our own record in step.
  const word = msg.body.trim().toUpperCase();
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(word) || ['START', 'UNSTOP', 'YES'].includes(word)) {
    await found.handle.db.update(customers)
      .set({ smsOptIn: ['START', 'UNSTOP', 'YES'].includes(word), updatedAt: sql`now()` })
      .where(eq(customers.id, found.customer.id));
  }
  await fileIncoming(found, { channel: 'sms', from: phone, to: msg.to, subject: null, body: msg.body, mediaUrls: msg.mediaUrls, providerId: msg.sid }, request);
}

// Returns false when the sender is nobody we know: nothing is saved then, so
// junk sent to the reply address cannot add customers.
export async function receiveEmail(msg: { from: string; to: string; customerId: string | null; subject: string; body: string }, request: Request) {
  const found = await findCustomer({ id: msg.customerId, email: normalizeEmail(msg.from) });
  if (!found) {
    await sendAlert({ level: 'info', title: 'Email from an unknown sender was not filed', detail: `${msg.from}: ${msg.subject.slice(0, 120)}` });
    return false;
  }
  await fileIncoming(found, { channel: 'email', from: msg.from, to: msg.to, subject: msg.subject || null, body: msg.body }, request);
  return true;
}

export async function recordSmsStatus(sid: string, status: string) {
  for (const { db } of reachableDbs()) {
    const handle = await db;
    const rows = await handle.db.update(messages).set({ deliveryStatus: status })
      .where(eq(messages.providerId, sid)).returning({ id: messages.id });
    if (rows.length) return;
  }
}
