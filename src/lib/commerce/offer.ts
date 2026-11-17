// An offer: one customer's pendant, quoted and ready to buy. It is what the
// product detail page (/pendant/[offerId]) shows. Each offer is written by
// hand after a quote request: renders, sizes, prices and a note.
//
// Prototype: there is one sample offer and no store behind it yet. When the
// quoting system exists, getOffer() is the only thing that has to change.

import type { BirthData } from '@/lib/natal-chords';
import type { PendantDesign } from './design';

export type MetalId = 'silver' | 'gold10' | 'gold14';
export type Tone = 'silver' | 'gold';

export interface OfferMetal {
  id: MetalId;
  name: string;   // "14k yellow gold"
  short: string;  // "14k gold"
  tone: Tone;     // which renders to show
}

export interface OfferSize {
  mm: number;
  blurb: string;  // one line under the size, e.g. how it wears
}

export interface OfferImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  // Leave either out for "any". A silver view with no silver render falls
  // back to the gold one, shown desaturated, until a real render replaces it.
  tone?: Tone;
  mm?: number;
}

export interface PendantOffer {
  id: string;
  firstName: string;       // '' until known: the page then says "you"
  title: string;
  subtitle: string;        // "January 1, 2000 · Lexington"
  note: { from: string; paragraphs: string[] };
  metals: OfferMetal[];
  sizes: OfferSize[];
  // Cents, by metal then by size in mm.
  prices: Record<MetalId, Record<number, number>>;
  images: OfferImage[];
  chain: string;
  leadTime: string;
  // Draws the flat natal chart in the gallery: the birth moment and the
  // aspect types that are in the pendant.
  birth?: BirthData;
  birthPlace?: string;
  aspects?: string[];
  // Reopens this design in the configurator (see designQuery).
  designQuery?: string;
}

export const SAMPLE_OFFER_ID = 'sample';

// Placeholder renders and prices. "{name}" in the note is the first name.
const SAMPLE_OFFER: PendantOffer = {
  id: SAMPLE_OFFER_ID,
  firstName: '',
  title: 'Your Aspect Pendant',
  subtitle: 'January 1, 2000 · Lexington',
  note: {
    from: 'Lawrence',
    paragraphs: [
      'Hey {name}, I really like how your pendant turned out.',
      'These are the settings I chose for the 17, 19 and 21 millimeter versions. The smallest has slightly heavier bars so the openings still read clearly at that size. Let me know what you think.',
    ],
  },
  metals: [
    { id: 'gold14', name: '14k yellow gold', short: '14k gold', tone: 'gold' },
    { id: 'gold10', name: '10k yellow gold', short: '10k gold', tone: 'gold' },
    { id: 'silver', name: 'Sterling silver', short: 'Silver', tone: 'silver' },
  ],
  sizes: [
    { mm: 17, blurb: 'Fine and close to the collarbone' },
    { mm: 19, blurb: 'A little more presence' },
    { mm: 21, blurb: 'The boldest, with the finest detail' },
  ],
  prices: {
    silver: { 17: 18000, 19: 21000, 21: 24000 },
    gold10: { 17: 52000, 19: 61000, 21: 70000 },
    gold14: { 17: 69000, 19: 82000, 21: 95000 },
  },
  images: [
    { src: '/renders/studio-1.webp', alt: 'The pendant on its chain', width: 1600, height: 2000 },
    { src: '/renders/studio-2.webp', alt: 'The pendant on its chain, second view', width: 1600, height: 2000 },
    { src: '/renders/studio-3.webp', alt: 'The pendant on its chain, third view', width: 1600, height: 2000 },
    { src: '/renders/studio-4.webp', alt: 'The pendant on its chain, fourth view', width: 1600, height: 2000 },
  ],
  birth: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, lat: 38.0464, lon: -84.497 },
  birthPlace: 'Lexington, Fayette County',
  aspects: ['opposition', 'trine', 'square', 'sextile'],
  chain: '45 cm cable chain in the same metal',
  leadTime: 'Cast to order. Ships within 3 weeks, with free insured shipping in the US.',
};

export function getOffer(id: string): PendantOffer | null {
  return id === SAMPLE_OFFER_ID ? SAMPLE_OFFER : null;
}

// What a bag item says about the offer it came from. Checkout looks the
// offer up again and takes the price from it, never from the browser.
export interface OfferChoice { offerId: string; metal: MetalId; mm: number }

// The price for a choice, or null if the offer has no such metal or size.
export function offerPrice(offer: PendantOffer, metal: string, mm: number) {
  const m = offer.metals.find((x) => x.id === metal);
  if (!m || !offer.sizes.some((s) => s.mm === mm)) return null;
  const cents = offer.prices[m.id]?.[mm];
  return Number.isInteger(cents) && cents > 0 ? { metal: m, unitAmount: cents } : null;
}

// The renders for one metal tone and size, best matches only: an image made
// for this tone beats one made for any tone.
export function offerImages(offer: PendantOffer, tone: Tone, mm: number) {
  const fits = offer.images.filter((i) => i.mm === undefined || i.mm === mm);
  const exact = fits.filter((i) => i.tone === tone);
  if (exact.length) return { images: exact, standIn: false };
  const any = fits.filter((i) => i.tone === undefined);
  if (any.length) return { images: any, standIn: tone !== 'gold' };
  return { images: fits, standIn: fits.some((i) => i.tone !== tone) };
}

// What the configurator hands to the sample offer so the test flow shows the
// pendant that was just designed. Kept in sessionStorage, this tab only.
export const OFFER_PREVIEW_KEY = 'constelier-offer-preview';
export interface OfferPreview {
  firstName: string;
  subtitle: string;
  thumbnail: string | null;
  designQuery: string;
  birth?: BirthData;
  aspects?: string[];
  design?: PendantDesign;
}
