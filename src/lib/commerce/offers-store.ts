import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { DbHandle } from '@/lib/db/client';
import { customers, designs, offers, quoteRequests } from '@/lib/db/schema';
import { describeDesign, designQuery } from './design';
import {
  blankOfferContent, getOffer, offerProblems,
  type OfferContent, type OfferImage, type PendantOffer,
} from './offer';

// Offers in the database: written in the admin panel, shown at /pendant/[id].

// Random, so a pendant page cannot be found by guessing.
function newOfferId() {
  return `ofr_${randomBytes(12).toString('base64url')}`;
}

// Starts a draft for a quote request, filled in from the customer and the
// design they made.
export async function createDraftOffer(handle: DbHandle, quoteRequestId: string) {
  const { db } = handle;
  const [row] = await db.select({ request: quoteRequests, customer: customers })
    .from(quoteRequests)
    .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
    .where(eq(quoteRequests.id, quoteRequestId));
  if (!row) return null;
  const [design] = row.request.designId
    ? await db.select().from(designs).where(eq(designs.id, row.request.designId))
    : [];
  const content = blankOfferContent();
  content.firstName = row.customer.name ?? '';
  if (design) {
    const b = design.spec.birth;
    content.subtitle = describeDesign(design.spec).subtitle;
    content.birth = {
      year: +b.year, month: +b.month, day: +b.day, hour: +b.hour, minute: +b.minute, lat: b.lat, lon: b.lon,
    };
    content.birthPlace = b.location;
    content.aspects = design.spec.aspects;
    content.designQuery = designQuery(design.spec);
  }
  const [offer] = await db.insert(offers).values({
    id: newOfferId(),
    quoteRequestId,
    customerId: row.customer.id,
    designId: design?.id ?? null,
    content,
  }).returning();
  return offer;
}

export async function saveOfferContent(handle: DbHandle, id: string, content: OfferContent) {
  await handle.db.update(offers).set({ content, updatedAt: sql`now()` }).where(eq(offers.id, id));
}

// Returns the reasons it cannot go live, or an empty list once it has.
export async function publishOffer(handle: DbHandle, id: string) {
  const [offer] = await handle.db.select().from(offers).where(eq(offers.id, id));
  if (!offer) return ['This offer no longer exists.'];
  const problems = offerProblems(offer.content);
  if (problems.length) return problems;
  await handle.db.update(offers)
    .set({ status: 'published', publishedAt: sql`coalesce(${offers.publishedAt}, now())`, updatedAt: sql`now()` })
    .where(eq(offers.id, id));
  return [];
}

export async function unpublishOffer(handle: DbHandle, id: string) {
  await handle.db.update(offers).set({ status: 'draft', updatedAt: sql`now()` }).where(eq(offers.id, id));
}

// The offer as the pendant page and checkout use it. Drafts are only for the
// admin preview. The built-in sample needs no database.
export async function loadOffer(
  handle: DbHandle | null,
  id: string,
  { allowDraft = false }: { allowDraft?: boolean } = {},
): Promise<PendantOffer | null> {
  const sample = getOffer(id);
  if (sample) return sample;
  if (!handle || !id.startsWith('ofr_')) return null;
  const [row] = await handle.db.select({ offer: offers, design: designs })
    .from(offers)
    .leftJoin(designs, eq(designs.id, offers.designId))
    .where(eq(offers.id, id));
  if (!row || (row.offer.status !== 'published' && !allowDraft)) return null;
  const { content } = row.offer;
  // Until renders are added, the page shows the customer's own snapshot.
  const images: OfferImage[] = content.images.length || !row.design?.thumbnailUrl
    ? content.images
    : [{ src: row.design.thumbnailUrl, alt: 'Your pendant, as you designed it', width: 600, height: 600 }];
  return {
    ...content,
    id: row.offer.id,
    images,
    design: row.design ? { spec: row.design.spec, geometry: row.design.geometry } : undefined,
  };
}
