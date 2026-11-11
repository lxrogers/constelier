import 'server-only';
import type Stripe from 'stripe';

// US-only, cast-to-order shipping. Amounts in cents. Shipping is taxed where
// the state taxes it (Stripe Tax decides from the tax code).
export const SHIPPING_OPTIONS: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      display_name: 'Insured standard shipping',
      fixed_amount: { amount: 0, currency: 'usd' },
      tax_behavior: 'exclusive',
      tax_code: 'txcd_92010001',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 3 },
        maximum: { unit: 'business_day', value: 5 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      display_name: 'Insured express shipping',
      fixed_amount: { amount: 3500, currency: 'usd' },
      tax_behavior: 'exclusive',
      tax_code: 'txcd_92010001',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 1 },
        maximum: { unit: 'business_day', value: 2 },
      },
    },
  },
];

// "General - Tangible Goods". Swap for a more specific code if a state
// treats jewelry differently and Stripe adds one.
export const PENDANT_TAX_CODE = 'txcd_99999999';

export const PRODUCTION_NOTE =
  'Each pendant is cast to order and ships within 3 weeks. Delivery times above start once it ships.';

export const automaticTaxEnabled = () => process.env.STRIPE_AUTOMATIC_TAX !== 'off';
