import 'server-only';
import { getDb, getDbAt, type DbHandle } from '@/lib/db/client';
import { SITE_URL } from '@/lib/site';

// The admin panel runs on the production site and can look at two sets of
// data: production's own database, and staging's (STAGING_DATABASE_URL, set
// only in the Production environment). Every admin query names which one.
//
// On staging itself, or on a laptop, there is only that deployment's own
// database, shown under the "staging" name.
export type AdminEnv = 'production' | 'staging';

export function thisEnv(): AdminEnv {
  return process.env.VERCEL_ENV === 'production' ? 'production' : 'staging';
}

export function adminEnvs(): AdminEnv[] {
  if (thisEnv() !== 'production') return ['staging'];
  return process.env.STAGING_DATABASE_URL ? ['production', 'staging'] : ['production'];
}

export function isAdminEnv(value: string): value is AdminEnv {
  return (adminEnvs() as string[]).includes(value);
}

export function envLabel(env: AdminEnv) {
  if (env === 'production') return 'Production';
  return process.env.VERCEL ? 'Staging' : 'Local';
}

// Null when that environment has no database configured here.
export function dbForEnv(env: AdminEnv): Promise<DbHandle> | null {
  if (env === thisEnv()) return getDb();
  const url = process.env.STAGING_DATABASE_URL;
  return env === 'staging' && url ? getDbAt(url) : null;
}

// Every database this deployment can reach, its own first. Incoming replies
// use this to find which one the sender is in.
export function reachableDbs(): { env: AdminEnv; db: Promise<DbHandle> }[] {
  return adminEnvs()
    .sort((a) => (a === thisEnv() ? -1 : 1))
    .flatMap((env) => {
      const db = dbForEnv(env);
      return db ? [{ env, db }] : [];
    });
}

function originOf(request?: Request | null) {
  return request ? new URL(request.url).origin : 'http://localhost:3000';
}

// Where customers see that environment's site (pendant pages live here).
export function siteOrigin(env: AdminEnv, request?: Request | null) {
  if (env === 'production') return SITE_URL;
  if (process.env.STAGING_SITE_URL) return process.env.STAGING_SITE_URL.replace(/\/$/, '');
  return process.env.VERCEL ? 'https://staging.constelier.com' : originOf(request);
}

// A link into the admin panel, which is always on this deployment.
export function adminUrl(env: AdminEnv, path: string, request?: Request | null) {
  return `${siteOrigin(thisEnv(), request)}/admin/${env}${path}`;
}
