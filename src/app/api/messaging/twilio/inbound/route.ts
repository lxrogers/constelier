import { receiveSms } from '@/lib/messaging/messages';
import { twilioSignatureValid } from '@/lib/messaging/providers';
import { SITE_URL } from '@/lib/site';

// Twilio calls this for every text sent to the Constelier number. Set it as
// the number's (or Messaging Service's) "a message comes in" webhook.
export async function POST(request: Request) {
  const params = Object.fromEntries(new URLSearchParams(await request.text()));
  const { pathname, search } = new URL(request.url);
  // Twilio signs the address it was given, which is the public one.
  if (!twilioSignatureValid([request.url, `${SITE_URL}${pathname}${search}`], params, request.headers.get('x-twilio-signature'))) {
    return new Response('invalid signature', { status: 403 });
  }
  const mediaUrls: string[] = [];
  for (let i = 0; i < Number(params.NumMedia ?? 0); i++) {
    if (params[`MediaUrl${i}`]) mediaUrls.push(params[`MediaUrl${i}`]);
  }
  await receiveSms({ from: params.From ?? '', to: params.To ?? '', body: params.Body ?? '', sid: params.MessageSid ?? '', mediaUrls }, request);
  // An empty reply: the answer is written by hand in the admin panel.
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
}
