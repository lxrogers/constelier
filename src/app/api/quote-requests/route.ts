import { after } from 'next/server';
import { parseDesign } from '@/lib/commerce/design';
import { designsWithoutThumbnail, setDesignThumbnail } from '@/lib/commerce/orders';
import { parseThumbnail, blobConfigured, storeThumbnail } from '@/lib/commerce/thumbnails';
import { getDb } from '@/lib/db/client';
import { normalizeEmail, normalizePhone } from '@/lib/quotes/contact';
import { createQuoteRequest } from '@/lib/quotes/requests';
import { thisEnv, adminUrl } from '@/lib/admin/env';
import { allow, clientIp } from '@/lib/rate-limit';
import { sendAlert } from '@/lib/alerts';

// The configurator's last step: saves who asked for a quote and the design
// they made. The maker answers by hand from the admin panel.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'invalid request' }, { status: 400 });

  // A field people never see. Whatever fills it in is not a person: say thanks
  // and save nothing.
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true });
  if (!allow(`quote:${clientIp(request.headers)}`, 5, 10 * 60 * 1000)) {
    return Response.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
  }

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 60) : '';
  if (!firstName) return Response.json({ error: 'Please add your first name.' }, { status: 400 });
  const channel = body.channel === 'text' ? 'sms' : 'email';
  const email = channel === 'email' ? normalizeEmail(body.contact) : null;
  const phone = channel === 'sms' ? normalizePhone(body.contact) : null;
  if (channel === 'email' && !email) return Response.json({ error: 'That email address does not look right.' }, { status: 400 });
  if (channel === 'sms' && !phone) return Response.json({ error: 'That phone number does not look right.' }, { status: 400 });

  const design = body.design == null ? null : parseDesign(body.design);
  if (body.design != null && !design) return Response.json({ error: 'invalid design' }, { status: 400 });

  const dbReady = getDb();
  if (!dbReady) {
    await sendAlert({ title: 'Quote request could not be saved', detail: 'No database is configured.' });
    return Response.json({ error: 'That did not go through. Please try again.' }, { status: 503 });
  }

  let saved;
  let handle;
  try {
    handle = await dbReady;
    saved = await createQuoteRequest(handle, { firstName, channel, email, phone, design });
  } catch (err) {
    await sendAlert({ title: 'Quote request could not be saved', detail: (err as Error).message });
    return Response.json({ error: 'That did not go through. Please try again.' }, { status: 503 });
  }

  const thumbnail = parseThumbnail(body.thumbnail);
  const db = handle;
  after(async () => {
    try {
      if (saved.designId && thumbnail && (await designsWithoutThumbnail(db, [saved.designId])).has(saved.designId)) {
        // Off Vercel there is no Blob store: keep the small snapshot itself.
        const url = blobConfigured()
          ? await storeThumbnail(saved.designId, thumbnail)
          : process.env.VERCEL ? null : body.thumbnail as string;
        if (url) await setDesignThumbnail(db, saved.designId, url);
      }
    } catch (err) {
      console.error('Could not store the quote request thumbnail:', (err as Error).message);
    }
    await sendAlert({
      level: 'info',
      title: `New quote request from ${firstName}`,
      detail: adminUrl(thisEnv(), `/requests/${saved.request.id}`, request),
      key: `quote:${saved.request.id}`,
    });
  });

  return Response.json({ ok: true });
}
