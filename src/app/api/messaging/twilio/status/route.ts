import { recordSmsStatus } from '@/lib/messaging/messages';
import { twilioSignatureValid } from '@/lib/messaging/providers';
import { SITE_URL } from '@/lib/site';

// Twilio's delivery updates for texts we sent (queued, sent, delivered,
// undelivered, failed). The address is passed with each send.
export async function POST(request: Request) {
  const params = Object.fromEntries(new URLSearchParams(await request.text()));
  const { pathname, search } = new URL(request.url);
  if (!twilioSignatureValid([request.url, `${SITE_URL}${pathname}${search}`], params, request.headers.get('x-twilio-signature'))) {
    return new Response('invalid signature', { status: 403 });
  }
  if (params.MessageSid && params.MessageStatus) await recordSmsStatus(params.MessageSid, params.MessageStatus);
  return new Response(null, { status: 204 });
}
