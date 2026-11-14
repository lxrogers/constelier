// Error alerts without a third-party sign-up: every alert is logged (Vercel
// keeps logs and can email on errors), and if ALERT_WEBHOOK_URL is set it is
// also posted there. A Slack or Discord incoming-webhook URL works as is:
// the body carries both `text` (Slack) and `content` (Discord).
//
// Repeats of the same alert are dropped for 10 minutes per server instance,
// and no instance posts more than 20 alerts in 10 minutes, so one broken page
// (or someone posting junk to /api/client-error) can't flood the channel.

const QUIET_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const recent = new Map<string, number>();
let sent: number[] = [];

export interface Alert {
  title: string;
  detail?: string;
  // Groups repeats. Defaults to the title.
  key?: string;
}

export async function sendAlert({ title, detail, key }: Alert) {
  console.error(`[alert] ${title}${detail ? `\n${detail}` : ''}`);

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const k = key ?? title;
  const now = Date.now();
  if ((recent.get(k) ?? 0) > now - QUIET_MS) return;
  sent = sent.filter((t) => t > now - QUIET_MS);
  if (sent.length >= MAX_PER_WINDOW) return;
  sent.push(now);
  recent.set(k, now);
  if (recent.size > 500) recent.clear();

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown';
  const text = `Constelier (${env}): ${title}${detail ? `\n${detail.slice(0, 1500)}` : ''}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text.slice(0, 2000) }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('[alert] webhook failed:', (err as Error).message);
  }
}
