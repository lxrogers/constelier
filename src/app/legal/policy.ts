import { SHIP_WITHIN_TEXT, EXPRESS_SHIPPING_CENTS, STANDARD_DELIVERY_DAYS, EXPRESS_DELIVERY_DAYS } from '@/lib/commerce/shop-terms';
import { formatUSD } from '@/lib/commerce/format';

// Every name, number and promise the policy pages use, in one place.
//
//   fill('…')     not decided yet: shows as [label] until you replace it
//   confirm('…')  a suggested or current value: highlighted until you confirm
//   'plain text'  final
//
// To finish a page: replace each fill() and confirm() with a plain string,
// then set LEGAL_DRAFT to false to drop the draft banner and the highlights
// and let search engines index the pages.

export const LEGAL_DRAFT = true;
export const LAST_UPDATED = 'November 12, 2026';

export type PolicyValue = string | { kind: 'fill' | 'confirm'; text: string };
const fill = (label: string): PolicyValue => ({ kind: 'fill', text: label });
const confirm = (value: string): PolicyValue => ({ kind: 'confirm', text: value });

export const POLICY = {
  // Who you are
  businessName: fill('Business legal name, e.g. "Constelier LLC" or your name dba Constelier'),
  businessAddress: fill('Business mailing address'),
  contactEmail: fill('Contact email, e.g. hello@constelier.com'),
  governingState: fill('State whose law governs, e.g. New York'),
  minimumAge: confirm('18'),

  // Orders
  productionTime: confirm(SHIP_WITHIN_TEXT),
  cancelWindow: confirm('24 hours'),
  metal: confirm('14k yellow gold'),
  caster: confirm('our casting partner in New York'),
  chainIncluded: fill('Chain included or sold separately, with length and metal'),

  // Shipping
  shipsTo: confirm('the United States'),
  standardShipping: confirm(`free insured shipping, ${STANDARD_DELIVERY_DAYS}`),
  expressShipping: confirm(`insured express shipping for ${formatUSD(EXPRESS_SHIPPING_CENTS)}, ${EXPRESS_DELIVERY_DAYS}`),
  carrier: fill('Carrier, e.g. USPS Priority or UPS'),
  signatureThreshold: confirm('$500'),
  damageReportDays: confirm('7 days'),
  packaging: confirm('plain outer packaging with no jewelry branding'),
  trackingStallDays: confirm('five business days'),
  lostPackageRule: fill('What you do if a package is marked delivered but missing'),

  // Warranty and repairs
  warrantyLength: confirm('one year'),
  postWarrantyRepairs: fill('Repairs after the warranty: at cost, quoted first, or not offered'),
  claimPhotosWithin: confirm('14 days'),

  // Privacy
  dataRetention: confirm('seven years, as tax and accounting records require'),
  privacyReplyDays: confirm('30 days'),
  waitlistRetention: confirm('until you unsubscribe or ask us to delete it'),
  textingProvider: fill('Text message provider, if you add texting (e.g. Twilio)'),
  accessibilityToday: fill('What works today with a keyboard and a screen reader: test the birth form, wheel pickers, bag and checkout first'),
  accessibilityPlan: confirm("We're adding text descriptions of each aspect and of the finished piece, so the design can be understood without seeing it."),
  emailProvider: fill('Email provider (e.g. Resend)'),
} satisfies Record<string, PolicyValue>;

// The one final-sale rule. Every page that mentions returns uses these words.
export const FINAL_SALE_SHORT =
  'Each pendant is cast to order from your chart, so all sales are final.';
