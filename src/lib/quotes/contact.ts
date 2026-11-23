// Cleaning up what people type into the quote form. No server-only imports:
// the tests use these directly.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Lower-cased and trimmed, or null if it does not look like an address.
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// A phone number as E.164 (+15555550123), or null. A number typed without a
// country code is taken to be in the US or Canada.
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// "+15555550123" as "(555) 555-0123"; other countries are shown as stored.
export function formatPhone(e164: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
