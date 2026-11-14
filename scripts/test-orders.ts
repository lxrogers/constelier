// Order-saving tests against an in-memory Postgres (pglite), no network.
//   npm run test:orders
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { count, eq } from 'drizzle-orm';
import { openDb, type DbHandle } from '../src/lib/db/client';
import { customers, designs, orders, orderItems, orderEvents } from '../src/lib/db/schema';
import { recordPaidOrder, saveDesigns } from '../src/lib/commerce/orders';
import { designId, encodeDesignMetadata } from '../src/lib/commerce/order-metadata';
import { sampleDesign, sampleSession } from './fixtures';

async function fresh(): Promise<DbHandle> {
  return openDb('pglite:memory', { migrate: true });
}
async function rows(h: DbHandle, table: typeof orders | typeof customers | typeof designs | typeof orderItems | typeof orderEvents) {
  const [r] = await h.db.select({ n: count() }).from(table);
  return r.n;
}

test('a paid checkout writes one customer, order, item and event', async () => {
  const h = await fresh();
  const design = sampleDesign();
  const id = designId(design);
  await saveDesigns(h, [{ id, design }]);
  const r = await recordPaidOrder(h, sampleSession({ sessionId: 'cs_1', designIds: [id] }), 'webhook');
  assert.equal(r.status, 'created');
  assert.equal(r.status === 'created' && r.number, 1001);
  assert.equal(await rows(h, orders), 1);
  assert.equal(await rows(h, orderItems), 1);
  assert.equal(await rows(h, orderEvents), 1);
  const [c] = await h.db.select().from(customers);
  assert.equal(c.email, 'test.buyer@example.com');
  const [d] = await h.db.select().from(designs);
  assert.equal(d.customerId, c.id, 'design is linked to the buyer');
  assert.equal(d.spec.birth.location, 'New York, NY, USA');
  const [o] = await h.db.select().from(orders);
  assert.equal(o.total, 41500 + 3700);
  assert.equal(o.promisedShipBy, '2026-12-03');
  assert.equal(o.shippingAddress?.city, 'Brooklyn');
  await h.close();
});

test('a replayed webhook creates nothing new', async () => {
  const h = await fresh();
  const design = sampleDesign();
  const id = designId(design);
  await saveDesigns(h, [{ id, design }]);
  const session = sampleSession({ sessionId: 'cs_2', designIds: [id] });
  const first = await recordPaidOrder(h, session, 'webhook');
  const again = await recordPaidOrder(h, session, 'webhook');
  const fromPage = await recordPaidOrder(h, session, 'success_page');
  assert.equal(first.status, 'created');
  assert.equal(again.status, 'exists');
  assert.equal(fromPage.status, 'exists');
  for (const t of [orders, orderItems, orderEvents, customers, designs] as const) assert.equal(await rows(h, t), 1);
  await h.close();
});

test('webhook and success page racing still make one order', async () => {
  const h = await fresh();
  const design = sampleDesign();
  const id = designId(design);
  await saveDesigns(h, [{ id, design }]);
  const session = sampleSession({ sessionId: 'cs_race', designIds: [id] });
  const results = await Promise.all([
    recordPaidOrder(h, session, 'webhook'),
    recordPaidOrder(h, session, 'success_page'),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['created', 'exists']);
  assert.equal(await rows(h, orders), 1);
  await h.close();
});

test('a returning customer keeps one row across orders', async () => {
  const h = await fresh();
  const a = sampleDesign(0), b = sampleDesign(1);
  await saveDesigns(h, [{ id: designId(a), design: a }, { id: designId(b), design: b }]);
  await recordPaidOrder(h, sampleSession({ sessionId: 'cs_a', designIds: [designId(a)] }), 'webhook');
  await recordPaidOrder(h, sampleSession({ sessionId: 'cs_b', designIds: [designId(b)], email: 'test.buyer@EXAMPLE.com' }), 'webhook');
  assert.equal(await rows(h, customers), 1);
  assert.equal(await rows(h, orders), 2);
  const nums = (await h.db.select({ n: orders.number }).from(orders)).map((r) => r.n).sort();
  assert.deepEqual(nums, [1001, 1002]);
  await h.close();
});

test('an order paid before the database existed is saved from Stripe metadata', async () => {
  const h = await fresh();
  const design = sampleDesign();
  const quote = { unitAmount: 41500, grams: 2.48, volumeMm3: 190, metal: '14k yellow gold' };
  const meta = encodeDesignMetadata(design, quote, { includeDesign: true });
  const r = await recordPaidOrder(h, sampleSession({ sessionId: 'cs_legacy', designIds: [meta.design_id], productMetadata: [meta] }), 'webhook');
  assert.equal(r.status, 'created');
  const [d] = await h.db.select().from(designs).where(eq(designs.id, meta.design_id));
  assert.equal(d.geometry.chords.length, 3);
  await h.close();
});

test('with a database, Stripe metadata carries no birth data', () => {
  const quote = { unitAmount: 41500, grams: 2.48, volumeMm3: 190, metal: '14k yellow gold' };
  const meta = encodeDesignMetadata(sampleDesign(), quote, { includeDesign: false });
  assert.deepEqual(Object.keys(meta).sort(), ['design_id', 'est_grams', 'metal']);
});

test('an order whose design row is missing throws so Stripe retries', async () => {
  const h = await fresh();
  await assert.rejects(
    recordPaidOrder(h, sampleSession({ sessionId: 'cs_missing', designIds: ['dsn_nope'] }), 'webhook'),
    /design rows missing/,
  );
  assert.equal(await rows(h, orders), 0);
  assert.equal(await rows(h, customers), 0);
  await h.close();
});
