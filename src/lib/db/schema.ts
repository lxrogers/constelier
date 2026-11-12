import {
  pgTable, pgEnum, uuid, text, integer, boolean, jsonb, timestamp, date,
  doublePrecision, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { DesignSpec, DesignGeometry } from '../commerce/design';

// Tables for Specs A to C of the build plan. Only customers, designs, orders,
// order_items and order_events are written today (by checkout and the Stripe
// webhook); messages and message_templates are ready for the admin hub.
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

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Always stored lower-cased; checkout emails are the account key.
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),
  smsOptIn: boolean('sms_opt_in').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('customers_email_key').on(t.email)]);

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

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  channel: messageChannel('channel').notNull(),
  to: text('to').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  mediaUrls: jsonb('media_urls').$type<string[]>(),
  providerId: text('provider_id'),
  deliveryStatus: text('delivery_status'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index('messages_order_idx').on(t.orderId)]);

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
