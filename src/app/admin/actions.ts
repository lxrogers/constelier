'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  adminEnabled, endSession, passwordMatches, requireAdmin, startSession,
} from '@/lib/admin/auth';
import { dbForEnv, isAdminEnv, type AdminEnv } from '@/lib/admin/env';
import { allow, clientIp } from '@/lib/rate-limit';
import { customers, offers, quoteRequests, quoteStatus, type QuoteStatus } from '@/lib/db/schema';
import { setQuoteNotes, setQuoteStatus } from '@/lib/quotes/requests';
import {
  createDraftOffer, publishOffer, saveOfferContent, unpublishOffer,
} from '@/lib/commerce/offers-store';
import type { OfferContent, OfferImage, Tone } from '@/lib/commerce/offer';
import { blobConfigured } from '@/lib/commerce/thumbnails';
import { sendToCustomer, type Channel } from '@/lib/messaging/messages';

// Every action the admin panel can take. Each one checks the session itself:
// a page being behind the sign-in does not protect the action it posts to.

export interface FormState { error?: string; ok?: string }

// ── Session ─────────────────────────────────────────────────────────────────

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  if (!adminEnabled()) return { error: 'The admin panel is not switched on.' };
  const ip = clientIp(await headers());
  if (!allow(`admin-sign-in:${ip}`, 5, 10 * 60 * 1000)) {
    return { error: 'Too many tries. Wait ten minutes and try again.' };
  }
  // The same short wait whether right or wrong.
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(String(form.get('password') ?? ''))) return { error: 'That password is not right.' };
  await startSession();
  redirect('/admin');
}

export async function signOut() {
  await endSession();
  redirect('/admin/login');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function open(env: string) {
  await requireAdmin();
  if (!isAdminEnv(env)) throw new Error('unknown environment');
  const db = dbForEnv(env);
  if (!db) throw new Error('no database for this environment');
  return { env: env as AdminEnv, handle: await db };
}

const requestPath = (env: string, id: string) => `/admin/${env}/requests/${id}`;

// ── Requests ────────────────────────────────────────────────────────────────

export async function updateStatus(env: string, requestId: string, form: FormData) {
  const { handle } = await open(env);
  const status = String(form.get('status'));
  if (!(quoteStatus.enumValues as string[]).includes(status)) return;
  await setQuoteStatus(handle, requestId, status as QuoteStatus);
  revalidatePath(requestPath(env, requestId));
}

export async function saveNotes(env: string, requestId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { handle } = await open(env);
  await setQuoteNotes(handle, requestId, String(form.get('notes') ?? '').slice(0, 10_000));
  revalidatePath(requestPath(env, requestId));
  return { ok: 'Saved' };
}

// ── Offers ──────────────────────────────────────────────────────────────────

export async function startOffer(env: string, requestId: string) {
  const { handle } = await open(env);
  await createDraftOffer(handle, requestId);
  revalidatePath(requestPath(env, requestId));
}

const text = (form: FormData, name: string, max = 300) => String(form.get(name) ?? '').trim().slice(0, max);

// Reads the offer editor. Sizes are rows: a row with no millimetres is dropped.
function contentFromForm(form: FormData, current: OfferContent): OfferContent {
  const sizes: OfferContent['sizes'] = [];
  const prices: OfferContent['prices'] = { silver: {}, gold10: {}, gold14: {} };
  for (let row = 0; row < 6; row++) {
    const mm = Number(form.get(`size_mm_${row}`));
    if (!Number.isFinite(mm) || mm < 8 || mm > 50 || sizes.some((s) => s.mm === mm)) continue;
    sizes.push({ mm, blurb: text(form, `size_blurb_${row}`, 120) });
    for (const metal of current.metals) {
      const dollars = Number(String(form.get(`price_${metal.id}_${row}`) ?? '').replace(/[$,\s]/g, ''));
      if (Number.isFinite(dollars) && dollars > 0) prices[metal.id][mm] = Math.round(dollars * 100);
    }
  }
  sizes.sort((a, b) => a.mm - b.mm);
  return {
    ...current,
    firstName: text(form, 'firstName', 60),
    title: text(form, 'title', 120) || current.title,
    subtitle: text(form, 'subtitle', 160),
    note: {
      from: text(form, 'noteFrom', 60) || current.note.from,
      paragraphs: String(form.get('note') ?? '').slice(0, 4000).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    },
    sizes,
    prices,
    chain: text(form, 'chain'),
    leadTime: text(form, 'leadTime'),
  };
}

export async function saveOffer(env: string, requestId: string, offerId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { handle } = await open(env);
  const [offer] = await handle.db.select().from(offers).where(eq(offers.id, offerId));
  if (!offer) return { error: 'This offer no longer exists.' };
  await saveOfferContent(handle, offerId, contentFromForm(form, offer.content));
  const intent = String(form.get('intent'));
  let state: FormState = { ok: 'Saved' };
  if (intent === 'publish') {
    const problems = await publishOffer(handle, offerId);
    state = problems.length ? { error: problems.join(' ') } : { ok: 'Published' };
  } else if (intent === 'unpublish') {
    await unpublishOffer(handle, offerId);
    state = { ok: 'Back to draft' };
  }
  revalidatePath(requestPath(env, requestId));
  return state;
}

export async function addOfferImage(env: string, requestId: string, offerId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { handle } = await open(env);
  const file = form.get('file');
  const width = Number(form.get('width')), height = Number(form.get('height'));
  if (!(file instanceof File) || !file.type.startsWith('image/') || file.size === 0) return { error: 'Choose an image.' };
  if (file.size > 4_000_000) return { error: 'That image is over 4 MB. Export it smaller.' };
  if (!(width > 0 && height > 0)) return { error: 'Could not read that image.' };
  if (!blobConfigured()) return { error: 'Photos need the Blob store, which is not connected here.' };
  const [offer] = await handle.db.select().from(offers).where(eq(offers.id, offerId));
  if (!offer) return { error: 'This offer no longer exists.' };

  const { put } = await import('@vercel/blob');
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const blob = await put(`offers/${offerId}/render.${ext}`, file, {
    access: 'public', contentType: file.type, addRandomSuffix: true, cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  const tone = String(form.get('tone'));
  const mm = Number(form.get('mm'));
  const image: OfferImage = {
    src: blob.url,
    alt: text(form, 'alt', 160) || 'The pendant on its chain',
    width, height,
    ...(tone === 'gold' || tone === 'silver' ? { tone: tone as Tone } : {}),
    ...(mm > 0 ? { mm } : {}),
  };
  await saveOfferContent(handle, offerId, { ...offer.content, images: [...offer.content.images, image] });
  revalidatePath(requestPath(env, requestId));
  return { ok: 'Photo added' };
}

export async function removeOfferImage(env: string, requestId: string, offerId: string, src: string) {
  const { handle } = await open(env);
  const [offer] = await handle.db.select().from(offers).where(eq(offers.id, offerId));
  if (!offer) return;
  await saveOfferContent(handle, offerId, { ...offer.content, images: offer.content.images.filter((i) => i.src !== src) });
  revalidatePath(requestPath(env, requestId));
}

// ── Messages ────────────────────────────────────────────────────────────────

export async function sendMessage(env: string, requestId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { env: adminEnv, handle } = await open(env);
  const [row] = await handle.db.select({ customer: customers })
    .from(quoteRequests)
    .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
    .where(eq(quoteRequests.id, requestId));
  if (!row) return { error: 'This request no longer exists.' };
  const channel: Channel = form.get('channel') === 'sms' ? 'sms' : 'email';
  const result = await sendToCustomer({
    env: adminEnv,
    handle,
    customer: row.customer,
    quoteRequestId: requestId,
    channel,
    subject: text(form, 'subject', 200),
    body: String(form.get('body') ?? '').slice(0, 10_000),
  });
  revalidatePath(requestPath(env, requestId));
  return 'error' in result ? { error: result.error } : { ok: 'Sent' };
}


