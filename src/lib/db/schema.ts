import {
  pgTable, pgEnum, uuid, text, integer, boolean, jsonb, timestamp, date,
  doublePrecision, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { DesignSpec, DesignGeometry } from '../commerce/design';
import type { OfferContent } from '../commerce/offer';

// A quote request adds a customer, their design and a quote_requests row.
// The maker then writes an offer (the pendant page), the customer pays through
// Stripe, and checkout plus the webhook write orders, order_items and
// order_events. messages holds every email and text sent to or received from a
// customer. message_templates is not used yet.
//
// Change this file, then run `npm run db:generate` to write a new migration
// into drizzle/ and `npm run db:migrate` to apply it.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// One straight run plus side states (Spec B).
export const orderStatus = pgEnum('order_status', [
  'paid', 'design_checked', 'sent_to_caster', 'cast', 'finishing', 'shipped', 'delivered',
  'on_hold', 'caster_problem', 'refunded', 'cancelled',
]);

export const messageChannel = pgEnum('message_channel', ['email', 'sms']);
export const messageDirection = pgEnum('message_direction', ['out', 'in']);

export const quoteStatus = pgEnum('quote_status', ['new', 'contacted', 'offer_sent', 'paid', 'closed']);
export const offerStatus = pgEnum('offer_status', ['draft', 'published']);

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Always stored lower-cased. Empty for someone who asked for a quote by
  // text and has not paid yet; Postgres allows many rows without one.
  email: text('email'),
  name: text('name'),
  // E.164 (+15555550123) when it came from the quote form.
  phone: text('phone'),
  smsOptIn: boolean('sms_opt_in').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('customers_email_key').on(t.email),
  index('customers_phone_idx').on(t.phone),
]);

// A design is saved when checkout starts, so Stripe only needs its id. The id
// is a hash of the design, so the same design is stored once.
export const designs = pgTable('designs', {
  id: text('id').primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  // Birth date, time and place live here and nowhere else.
  spec: jsonb('spec').$type<DesignSpec>().notNull(),
  geometry: jsonb('geometry').$type<DesignGeometry>().notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: createdAt(),
}, (t) => [index('designs_customer_idx').on(t.customerId)]);

// One submission of the quote form.
export const quoteRequests = pgTable('quote_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  // The design as the customer left it in the configurator.
  designId: text('design_id').references(() => designs.id),
  // How they asked to be reached.
  channel: messageChannel('channel').notNull(),
  status: quoteStatus('status').notNull().default('new'),
  // The maker's own notes. Never shown to the customer.
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('quote_requests_customer_idx').on(t.customerId),
  index('quote_requests_status_idx').on(t.status, t.createdAt),
]);

// A pendant page (/pendant/[id]): one customer's pendant, priced and ready to
// buy. The id is random, so the link is what gives access.
export const offers = pgTable('offers', {
  id: text('id').primaryKey(),
  quoteRequestId: uuid('quote_request_id').references(() => quoteRequests.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  // The design that goes in the bag, made at the size the customer picks.
  designId: text('design_id').references(() => designs.id),
  content: jsonb('content').$type<OfferContent>().notNull(),
  status: offerStatus('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('offers_quote_request_idx').on(t.quoteRequestId),
  index('offers_customer_idx').on(t.customerId),
]);

export interface ShippingAddress {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  // Short, human order number for emails and lookups (C1001, C1002…).
  number: integer('number').generatedAlwaysAsIdentity({ startWith: 1001 }).notNull(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  stripeSessionId: text('stripe_session_id').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: orderStatus('status').notNull().default('paid'),
  currency: text('currency').notNull().default('usd'),
  // All amounts in cents. Shipping is before tax; tax covers shipping tax too.
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  shipping: integer('shipping').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull(),
  shippingAddress: jsonb('shipping_address').$type<ShippingAddress>(),
  promisedShipBy: date('promised_ship_by'),
  // The pendant page this order was bought from, when there was one.
  offerId: text('offer_id').references(() => offers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('orders_stripe_session_key').on(t.stripeSessionId),
  uniqueIndex('orders_number_key').on(t.number),
  index('orders_customer_idx').on(t.customerId),
  index('orders_status_idx').on(t.status),
]);

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  designId: text('design_id').notNull().references(() => designs.id),
  description: text('description'),
  metal: text('metal').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  estGrams: doublePrecision('est_grams'),
  createdAt: createdAt(),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

// Every stage change, note and send on an order, oldest first.
export const orderEvents = pgTable('order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  fromStatus: orderStatus('from_status'),
  toStatus: orderStatus('to_status'),
  note: text('note'),
  data: jsonb('data').$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)]);

// Every email and text to or from a customer, oldest first in a thread.
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  quoteRequestId: uuid('quote_request_id').references(() => quoteRequests.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  direction: messageDirection('direction').notNull().default('out'),
  channel: messageChannel('channel').notNull(),
  from: text('from'),
  to: text('to').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  mediaUrls: jsonb('media_urls').$type<string[]>(),
  // Twilio's message SID or SendGrid's message id.
  providerId: text('provider_id'),
  deliveryStatus: text('delivery_status'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index('messages_customer_idx').on(t.customerId, t.createdAt),
  index('messages_provider_idx').on(t.providerId),
]);

export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  stage: orderStatus('stage').notNull(),
  channel: messageChannel('channel').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('message_templates_stage_channel_key').on(t.stage, t.channel)]);

export type Customer = typeof customers.$inferSelect;
export type Design = typeof designs.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
