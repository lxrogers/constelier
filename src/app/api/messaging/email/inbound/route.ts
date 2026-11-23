import { receiveEmail } from '@/lib/messaging/messages';
import { inboundEmailKeyValid } from '@/lib/messaging/providers';
import { addressOf, customerIdFromRecipients, htmlToText, stripQuotedReply } from '@/lib/messaging/text';

// SendGrid's Inbound Parse posts each email sent to the reply domain here, as
// a form. Set its destination to
//   https://www.constelier.com/api/messaging/email/inbound?key=<INBOUND_EMAIL_SECRET>
// Attachments are not kept.
export async function POST(request: Request) {
  if (!inboundEmailKeyValid(new URL(request.url).searchParams.get('key'))) {
    return new Response('forbidden', { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return new Response('bad request', { status: 400 });
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : '';
  };

  let envelopeTo: string[] = [];
  try {
    const to = JSON.parse(field('envelope') || '{}').to;
    if (Array.isArray(to)) envelopeTo = to.filter((v) => typeof v === 'string');
  } catch {
    // No envelope: the To header below still names the recipients.
  }
  const recipients = [...envelopeTo, ...field('to').split(',')];
  const text = field('text') || htmlToText(field('html'));
  await receiveEmail({
    from: addressOf(field('from')),
    to: addressOf(recipients[0] ?? ''),
    customerId: customerIdFromRecipients(recipients),
    subject: field('subject').slice(0, 300),
    body: stripQuotedReply(text) || text.trim() || '(no text)',
  }, request);
  // Always 200 once read, so SendGrid does not keep retrying mail we chose not to file.
  return new Response(null, { status: 200 });
}
