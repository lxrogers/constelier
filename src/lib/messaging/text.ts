// Small text helpers for incoming mail. No server-only imports: tested directly.

// "Ada Lovelace <ada@example.com>" → "ada@example.com"
export function addressOf(header: string) {
  const m = /<([^>]+)>/.exec(header);
  return (m ? m[1] : header).trim().toLowerCase();
}

const UUID = /reply\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i;

// The customer id inside a "reply+<id>@…" address, if any recipient has one.
export function customerIdFromRecipients(recipients: string[]) {
  for (const r of recipients) {
    const m = UUID.exec(r);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// What the person wrote, without the copy of the message they replied to.
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const cut = lines.findIndex((line, i) =>
    /^On .+wrote:\s*$/.test(line)
    || (/^On .+$/.test(line) && /wrote:\s*$/.test(lines[i + 1] ?? ''))
    || /^-{2,}\s*Original Message\s*-{2,}/i.test(line)
    || /^From:\s.+/.test(line) && /^(Sent|Date):\s/.test(lines[i + 1] ?? ''));
  const kept = (cut === -1 ? lines : lines.slice(0, cut)).filter((l) => !l.startsWith('>'));
  return kept.join('\n').trim();
}

export function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
