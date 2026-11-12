import type Stripe from 'stripe';
import type { PendantDesign } from '../src/lib/commerce/design';

// Made-up data for the seed script and the order tests. No real person.
export function sampleDesign(seed = 0): PendantDesign {
  return {
    spec: {
      birth: { year: '1994', month: '03', day: String(10 + seed).padStart(2, '0'), hour: '07', minute: '30', lat: 40.7128, lon: -74.006, location: 'New York, NY, USA' },
      aspects: ['conjunction', 'trine', 'square'],
      outlineStyle: 'liquid',
      liquidity: 0.5,
      borderThickness: 8,
      lineThickness: 3,
      filletRadius: 2,
    },
    geometry: {
      chords: [{ a1: 0.1 + seed, a2: 2.4 }, { a1: 1.2, a2: 4.1 }, { a1: 3.3, a2: 5.6 }],
      circleRadius: 100,
      minArea: 20,
      minAngle: 10,
    },
  };
}

// A paid Checkout Session shaped like what fulfillCheckout retrieves, with
// line items expanded to their products.
export function sampleSession(opts: {
  sessionId: string;
  designIds: string[];
  email?: string;
  productMetadata?: Record<string, string>[];
}): Stripe.Checkout.Session {
  const unit = 41500;
  const lineItems = opts.designIds.map((id, i) => ({
    id: `li_${i}`,
    object: 'item',
    description: 'Aspect Pendant',
    quantity: 1,
    amount_subtotal: unit,
    amount_total: unit,
    price: {
      id: `price_${i}`,
      unit_amount: unit,
      product: {
        id: `prod_${i}`,
        name: 'Aspect Pendant',
        metadata: opts.productMetadata?.[i] ?? { design_id: id, metal: '14k yellow gold', est_grams: '2.48' },
      },
    },
  }));
  const subtotal = unit * opts.designIds.length;
  return {
    id: opts.sessionId,
    object: 'checkout.session',
    created: Math.floor(Date.UTC(2026, 10, 12) / 1000),
    currency: 'usd',
    payment_status: 'paid',
    status: 'complete',
    amount_subtotal: subtotal,
    amount_total: subtotal + 3700,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 3700 },
    shipping_cost: { amount_subtotal: 0, amount_tax: 0, amount_total: 0 },
    customer: 'cus_test_123',
    customer_details: { email: opts.email ?? 'Test.Buyer@example.com', name: 'Test Buyer', phone: '+15555550100' },
    collected_information: {
      shipping_details: {
        name: 'Test Buyer',
        address: { line1: '1 Example St', line2: null, city: 'Brooklyn', state: 'NY', postal_code: '11201', country: 'US' },
      },
    },
    payment_intent: 'pi_test_123',
    line_items: { object: 'list', data: lineItems, has_more: false, url: '' },
  } as unknown as Stripe.Checkout.Session;
}
