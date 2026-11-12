import type Stripe from 'stripe';
import { after } from 'next/server';
import { parseDesign, describeDesign, MAX_BAG_ITEMS, MAX_QUANTITY } from '@/lib/commerce/design';
import { quoteDesign } from '@/lib/commerce/pricing';
import { encodeDesignMetadata, designId } from '@/lib/commerce/order-metadata';
import { saveDesigns, designsWithoutThumbnail, setDesignThumbnail } from '@/lib/commerce/orders';
import { parseThumbnail, blobConfigured, storeThumbnail } from '@/lib/commerce/thumbnails';
import { getDb } from '@/lib/db/client';
import { getStripe, siteUrl } from '@/lib/commerce/stripe';
import {
  SHIPPING_OPTIONS, PENDANT_TAX_CODE, PRODUCTION_NOTE, automaticTaxEnabled,
} from '@/lib/commerce/checkout';

// Turns the bag into a Stripe Checkout Session. Every price is computed here
// from the design's geometry; nothing the browser says about price is used.
// With a database, each design is saved here first and Stripe only gets its id.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) return Response.json({ error: 'bag is empty' }, { status: 400 });
  if (items.length > MAX_BAG_ITEMS) return Response.json({ error: 'too many items' }, { status: 400 });

  const dbReady = getDb();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const designIds: string[] = [];
  const toSave: { id: string; design: NonNullable<ReturnType<typeof parseDesign>>; thumbnail: ReturnType<typeof parseThumbnail> }[] = [];
  for (const item of items) {
    const design = parseDesign(item?.design);
    const quantity = Number.isInteger(item?.quantity) ? item.quantity : 1;
    if (!design || quantity < 1 || quantity > MAX_QUANTITY) {
      return Response.json({ error: 'invalid item in bag' }, { status: 400 });
    }
    let quote;
    try {
      quote = quoteDesign(design);
    } catch (err) {
      console.error('Checkout pricing failed:', err);
      return Response.json({ error: 'could not price an item in your bag' }, { status: 422 });
    }
    const metadata = encodeDesignMetadata(design, quote, { includeDesign: !dbReady });
    toSave.push({ id: designId(design), design, thumbnail: parseThumbnail(item?.thumbnail) });
    const { title, subtitle } = describeDesign(design.spec);
    designIds.push(metadata.design_id);
    lineItems.push({
      quantity,
      price_data: {
        currency: 'usd',
        unit_amount: quote.unitAmount,
        tax_behavior: 'exclusive',
        product_data: {
          name: title,
          description: `${subtitle} · ${quote.metal}`,
          tax_code: PENDANT_TAX_CODE,
          metadata,
        },
      },
    });
  }

  if (dbReady) {
    // Without its design row a paid order couldn't be made, so stop here.
    let handle;
    try {
      handle = await dbReady;
      await saveDesigns(handle, toSave);
    } catch (err) {
      console.error('Checkout could not save designs:', err);
      return Response.json({ error: 'could not start checkout' }, { status: 503 });
    }
    // Thumbnails are nice to have: store them after the response is sent.
    if (blobConfigured()) {
      const db = handle;
      after(async () => {
        try {
          const missing = await designsWithoutThumbnail(db, toSave.map((d) => d.id));
          for (const d of toSave) {
            if (!d.thumbnail || !missing.has(d.id)) continue;
            missing.delete(d.id);
            await setDesignThumbnail(db, d.id, await storeThumbnail(d.id, d.thumbnail));
          }
        } catch (err) {
          console.error('Could not store design thumbnails:', (err as Error).message);
        }
      });
    }
  }

  const origin = siteUrl(request);
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      automatic_tax: { enabled: automaticTaxEnabled() },
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: SHIPPING_OPTIONS,
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      customer_creation: 'always',
      allow_promotion_codes: true,
      custom_text: { shipping_address: { message: PRODUCTION_NOTE } },
      metadata: { design_ids: designIds.join(',').slice(0, 500) },
      payment_intent_data: { metadata: { design_ids: designIds.join(',').slice(0, 500) } },
      success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bag`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    const e = err as Stripe.errors.StripeError;
    console.error('Checkout session failed:', e.message);
    return Response.json({ error: 'could not start checkout' }, { status: 502 });
  }
}
