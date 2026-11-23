import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// The two services behind the admin panel's messages: Twilio for texts and
// Twilio SendGrid for email. Both are called over plain HTTPS, so there is no
// SDK to keep up to date.

const env = (name: string) => process.env[name]?.trim() || '';

export function emailConfigured() {
  return Boolean(env('SENDGRID_API_KEY') && env('MESSAGE_FROM_EMAIL'));
}

export function smsConfigured() {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN')
    && (env('TWILIO_FROM_NUMBER') || env('TWILIO_MESSAGING_SERVICE_SID')));
}

export function fromEmail() {
  return env('MESSAGE_FROM_EMAIL');
}

// Replies to "reply+<customer id>@<MESSAGE_REPLY_DOMAIN>" come back through
// SendGrid's Inbound Parse and land in that customer's thread.
export function replyAddress(customerId: string) {
  const domain = env('MESSAGE_REPLY_DOMAIN');
  return domain ? `reply+${customerId}@${domain}` : null;
}

export interface Sent { providerId: string | null; from: string; status: string }

export async function sendEmail(msg: { to: string; subject: string; body: string; replyTo: string | null }): Promise<Sent> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('SENDGRID_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: fromEmail(), name: env('MESSAGE_FROM_NAME') || 'Constelier' },
      ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
      subject: msg.subject,
      content: [{ type: 'text/plain', value: msg.body }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null) as { errors?: { message?: string }[] } | null;
    throw new Error(data?.errors?.[0]?.message || `SendGrid answered ${res.status}`);
  }
  return { providerId: res.headers.get('x-message-id'), from: fromEmail(), status: 'sent' };
}

export async function sendSms(msg: { to: string; body: string; statusCallback: string | null }): Promise<Sent> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const form = new URLSearchParams({ To: msg.to, Body: msg.body });
  const service = env('TWILIO_MESSAGING_SERVICE_SID');
  if (service) form.set('MessagingServiceSid', service);
  else form.set('From', env('TWILIO_FROM_NUMBER'));
  if (msg.statusCallback) form.set('StatusCallback', msg.statusCallback);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => null) as { sid?: string; status?: string; from?: string; message?: string } | null;
  if (!res.ok) throw new Error(data?.message || `Twilio answered ${res.status}`);
  return { providerId: data?.sid ?? null, from: data?.from || env('TWILIO_FROM_NUMBER') || service, status: data?.status ?? 'queued' };
}

// Twilio signs each webhook: HMAC-SHA1, keyed with the auth token, over the
// URL followed by every POST field name and value in name order.
// https://www.twilio.com/docs/usage/security
export function twilioSignature(url: string, params: Record<string, string>, authToken: string) {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  return createHmac('sha1', authToken).update(data).digest('base64');
}

export function twilioSignatureValid(urls: string[], params: Record<string, string>, given: string | null) {
  const token = env('TWILIO_AUTH_TOKEN');
  if (!token || !given) return false;
  const got = Buffer.from(given);
  return urls.some((url) => {
    const want = Buffer.from(twilioSignature(url, params, token));
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

// SendGrid's Inbound Parse does not sign its posts, so the webhook URL
// carries a secret (?key=…) that only SendGrid has been given.
export function inboundEmailKeyValid(given: string | null) {
  const secret = env('INBOUND_EMAIL_SECRET');
  if (secret.length < 16 || !given) return false;
  const a = Buffer.from(secret), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
