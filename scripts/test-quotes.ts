// Quote request, offer and message tests against an in-memory Postgres
// (pglite). No network: the two message providers are stubbed.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { openDb, type DbHandle } from '../src/lib/db/client';
import { customers, messages, orders, quoteRequests } from '../src/lib/db/schema';
import { recordPaidOrder } from '../src/lib/commerce/orders';
import { designId } from '../src/lib/commerce/order-metadata';
import { createDraftOffer, loadOffer, publishOffer, saveOfferContent } from '../src/lib/commerce/offers-store';
import { createQuoteRequest, getQuoteRequest, listQuoteRequests } from '../src/lib/quotes/requests';
import { formatPhone, normalizeEmail, normalizePhone } from '../src/lib/quotes/contact';
import { sendToCustomer } from '../src/lib/messaging/messages';
import { addressOf, customerIdFromRecipients, stripQuotedReply } from '../src/lib/messaging/text';
import { sampleDesign, sampleSession } from './fixtures';

const fresh = (): Promise<DbHandle> => openDb('pglite:memory', { migrate: true });

const byEmail = (email: string, seed = 0) => ({
  firstName: 'Ada', channel: 'email' as const, email, phone: null, design: sampleDesign(seed),
});
const byText = (phone: string) => ({
  firstName: 'Grace', channel: 'sms' as const, email: null, phone, design: sampleDesign(),
});

async function pricedOffer(h: DbHandle, requestId: string) {
  const draft = await createDraftOffer(h, requestId);
  assert.ok(draft);
  const prices = { silver: { 17: 18000, 19: 21000, 21: 24000 }, gold10: { 17: 52000, 19: 61000, 21: 70000 }, gold14: { 17: 69000, 19: 82000, 21: 95000 } };
  await saveOfferContent(h, draft.id, { ...draft.content, prices });
  return draft;
}

test('contact details are cleaned up', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
  assert.equal(normalizeEmail('not an address'), null);
  assert.equal(normalizePhone('(555) 555-0123'), '+15555550123');
  assert.equal(normalizePhone('1-555-555-0123'), '+15555550123');
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('+15555550123'), '(555) 555-0123');
});

test('a quote request adds the customer, their design and one request', async () => {
  const h = await fresh();
  const { request, customer } = await createQuoteRequest(h, byEmail('ada@example.com'));
  assert.equal(request.status, 'new');
  assert.equal(customer.name, 'Ada');
  const detail = await getQuoteRequest(h, request.id);
  assert.equal(detail?.design?.id, designId(sampleDesign()));
  assert.equal(detail?.design?.customerId, customer.id, 'the design belongs to them');
  const list = await listQuoteRequests(h);
  assert.equal(list.length, 1);
  assert.equal(list[0].spec?.birth.location, 'New York, NY, USA');
  await h.close();
});

test('asking twice keeps one customer', async () => {
  const h = await fresh();
  await createQuoteRequest(h, byEmail('ada@example.com'));
  await createQuoteRequest(h, byEmail('ada@example.com', 1));
  await createQuoteRequest(h, byText('+15555550123'));
  await createQuoteRequest(h, byText('+15555550123'));
  assert.equal((await h.db.select().from(customers)).length, 2);
  assert.equal((await h.db.select().from(quoteRequests)).length, 4);
  const [texter] = await h.db.select().from(customers).where(eq(customers.phone, '+15555550123'));
  assert.equal(texter.email, null);
  assert.equal(texter.smsOptIn, true, 'choosing "Text me" is agreeing to texts');
  await h.close();
});

test('a draft offer is hidden, and cannot go live without prices', async () => {
  const h = await fresh();
  const { request } = await createQuoteRequest(h, byEmail('ada@example.com'));
  const draft = await createDraftOffer(h, request.id);
  assert.ok(draft);
  assert.match(draft.id, /^ofr_/);
  assert.equal(draft.content.firstName, 'Ada');
  assert.equal(draft.content.subtitle, 'March 10, 1994 · New York');
  assert.equal(await loadOffer(h, draft.id), null);
  assert.ok(await loadOffer(h, draft.id, { allowDraft: true }));
  const problems = await publishOffer(h, draft.id);
  assert.equal(problems.length, 9, 'three metals at three sizes have no price');
  assert.equal(await loadOffer(h, draft.id), null);
  await h.close();
});

test('a published offer loads with its design, and the sample needs no database', async () => {
  const h = await fresh();
  const { request } = await createQuoteRequest(h, byEmail('ada@example.com'));
  const draft = await pricedOffer(h, request.id);
  assert.deepEqual(await publishOffer(h, draft.id), []);
  const offer = await loadOffer(h, draft.id);
  assert.equal(offer?.prices.gold14[19], 82000);
  assert.equal(offer?.design?.geometry.chords.length, 3);
  assert.equal((await loadOffer(null, 'sample'))?.id, 'sample');
  assert.equal(await loadOffer(h, 'ofr_does_not_exist'), null);
  await h.close();
});

test('paying from a pendant page links the order to the offer and its customer', async () => {
  const h = await fresh();
  // Asked by text, so there is no email on file until they pay.
  const { request, customer, designId: id } = await createQuoteRequest(h, byText('+15555550123'));
  const draft = await pricedOffer(h, request.id);
  await publishOffer(h, draft.id);
  const session = sampleSession({
    sessionId: 'cs_offer', designIds: [id!],
    productMetadata: [{ design_id: id!, metal: '14k yellow gold', offer_id: draft.id, size_mm: '19' }],
  });
  const result = await recordPaidOrder(h, session, 'webhook');
  assert.equal(result.status, 'created');
  const all = await h.db.select().from(customers);
  assert.equal(all.length, 1, 'no second customer for the same person');
  assert.equal(all[0].id, customer.id);
  assert.equal(all[0].email, 'test.buyer@example.com');
  const [order] = await h.db.select().from(orders);
  assert.equal(order.offerId, draft.id);
  assert.equal(order.customerId, customer.id);
  const [after] = await h.db.select().from(quoteRequests);
  assert.equal(after.status, 'paid');
  await h.close();
});

test('an offer bought with an email that is already another customer uses that customer', async () => {
  const h = await fresh();
  await createQuoteRequest(h, byEmail('test.buyer@example.com', 1));
  const { request, designId: id } = await createQuoteRequest(h, byText('+15555550123'));
  const draft = await pricedOffer(h, request.id);
  await publishOffer(h, draft.id);
  const session = sampleSession({
    sessionId: 'cs_other', designIds: [id!],
    productMetadata: [{ design_id: id!, metal: '14k yellow gold', offer_id: draft.id }],
  });
  assert.equal((await recordPaidOrder(h, session, 'webhook')).status, 'created');
  assert.equal((await h.db.select().from(customers)).length, 2);
  const [order] = await h.db.select().from(orders);
  const [buyer] = await h.db.select().from(customers).where(eq(customers.email, 'test.buyer@example.com'));
  assert.equal(order.customerId, buyer.id);
  await h.close();
});

test('messages: staging only sends to the allowlist, and a send is filed on the thread', async () => {
  const h = await fresh();
  const { request, customer } = await createQuoteRequest(h, byEmail('ada@example.com'));
  const send = (env: 'production' | 'staging', body = 'Hello Ada') => sendToCustomer({
    env, handle: h, customer, quoteRequestId: request.id, channel: 'email', subject: '', body,
  });

  assert.match(JSON.stringify(await send('production')), /not set up/);

  process.env.SENDGRID_API_KEY = 'SG.test';
  process.env.MESSAGE_FROM_EMAIL = 'hello@mail.example.com';
  process.env.MESSAGE_REPLY_DOMAIN = 'mail.example.com';
  const realFetch = globalThis.fetch;
  const posted: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    posted.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(null, { status: 202, headers: { 'x-message-id': 'sg_1' } });
  }) as typeof fetch;
  try {
    assert.match(JSON.stringify(await send('staging')), /allowlist/);
    assert.equal(posted.length, 0, 'nothing left the building');

    process.env.MESSAGE_ALLOWLIST = 'someone@example.com, Ada@Example.com';
    assert.deepEqual(await send('staging'), { ok: true });
    assert.deepEqual(await send('production', 'Your page: https://www.example.com/pendant/ofr_abc'), { ok: true });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(posted.length, 2);
  assert.deepEqual(posted[0].body.reply_to, { email: `reply+${customer.id}@mail.example.com` });
  const thread = await h.db.select().from(messages).orderBy(messages.createdAt);
  assert.equal(thread.length, 2);
  assert.equal(thread[0].direction, 'out');
  assert.equal(thread[0].providerId, 'sg_1');
  assert.equal(thread[0].subject, 'Your Constelier pendant');
  const [after] = await h.db.select().from(quoteRequests);
  assert.equal(after.status, 'offer_sent', 'sending the pendant page link moves the request on');
  await h.close();
});

test('incoming email: who it is from, which customer, and what they wrote', () => {
  assert.equal(addressOf('Ada Lovelace <Ada@Example.com>'), 'ada@example.com');
  const id = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  assert.equal(customerIdFromRecipients(['hello@mail.example.com', `reply+${id}@mail.example.com`]), id);
  assert.equal(customerIdFromRecipients(['hello@mail.example.com']), null);
  const reply = 'Yes, the 19 mm please.\n\nThanks!\n\nOn Mon, Nov 23, 2026 at 9:14 AM Constelier <hello@mail.example.com> wrote:\n> Which size would you like?\n';
  assert.equal(stripQuotedReply(reply), 'Yes, the 19 mm please.\n\nThanks!');
  assert.equal(stripQuotedReply('Just this.'), 'Just this.');
});


