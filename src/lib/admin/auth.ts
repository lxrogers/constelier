import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

// One owner, one password (ADMIN_PASSWORD). Signing in sets a signed cookie
// that lasts 30 days; changing the password signs everyone out, because the
// signing key is made from it. With no password set, the admin panel does not
// exist (every admin page is a 404).
const COOKIE = 'constelier_admin';
const MAX_AGE_S = 60 * 60 * 24 * 30;
export const MIN_PASSWORD_LENGTH = 12;

function password() {
  return process.env.ADMIN_PASSWORD ?? '';
}

export function adminEnabled() {
  return password().length >= MIN_PASSWORD_LENGTH;
}

const digest = (s: string) => createHash('sha256').update(s).digest();

export function passwordMatches(input: string) {
  return adminEnabled() && timingSafeEqual(digest(input), digest(password()));
}

function sign(expires: number) {
  const key = digest(`constelier-admin-session:${password()}`);
  return createHmac('sha256', key).update(String(expires)).digest('base64url');
}

export async function startSession() {
  const expires = Date.now() + MAX_AGE_S * 1000;
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(COOKIE)?.value ?? '';
  const [expires, mac] = value.split('.');
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  const good = Buffer.from(sign(Number(expires)));
  const given = Buffer.from(mac);
  return good.length === given.length && timingSafeEqual(good, given);
}

// First line of every admin page and every admin action.
export async function requireAdmin() {
  if (!adminEnabled()) notFound();
  if (!(await isAdmin())) redirect('/admin/login');
}
