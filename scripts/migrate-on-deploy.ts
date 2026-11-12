// Runs as the first step of `npm run build`, so every Vercel deploy brings
// its database up to the latest migration in drizzle/ before the app builds.
//
// - Uses DATABASE_URL_UNPOOLED (a direct connection, set by the Neon
//   integration) when present, else DATABASE_URL. A session-level advisory
//   lock needs a direct connection, not the pooler.
// - No database URL, or a local pglite: URL: logs and does nothing, so local
//   and fork builds still pass. (Local builds don't read .env.local here, so
//   `npm run build` on your Mac never touches a remote database.)
// - Concurrent builds (several previews at once) queue on an advisory lock;
//   whoever goes second finds nothing left to apply.
// - Set SKIP_DB_MIGRATE=1 to skip it for a build.
// - A failed migration fails the build, so a deploy never ships code that
//   expects tables the database doesn't have.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { MIGRATIONS_FOLDER } from '../src/lib/db/client';

// Any fixed 64-bit number; only has to be the same for every build.
const LOCK_KEY = 4_217_203_311;
const LOCK_WAIT_MS = 120_000;

const log = (msg: string) => console.log(`[db:migrate] ${msg}`);

async function main() {
  if (process.env.SKIP_DB_MIGRATE === '1') return log('SKIP_DB_MIGRATE=1, skipping.');
  const source = process.env.DATABASE_URL_UNPOOLED ? 'DATABASE_URL_UNPOOLED' : 'DATABASE_URL';
  const url = process.env[source];
  if (!url) return log('No database URL set, skipping (orders will only be logged).');
  if (url.startsWith('pglite:')) return log('Local pglite database migrates itself on first use, skipping.');

  const env = process.env.VERCEL_ENV ?? 'local';
  log(`Applying migrations for ${env} using ${source}.`);
  // One connection, so the lock and the migrations share a session.
  const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 15 });
  try {
    await acquireLock(sql);
    try {
      const before = await appliedCount(sql);
      await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
      const after = await appliedCount(sql);
      log(after > before ? `Applied ${after - before} migration(s); ${after} total.` : `Already up to date (${after} applied).`);
    } finally {
      await sql`select pg_advisory_unlock(${LOCK_KEY})`;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function acquireLock(sql: postgres.Sql) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let waited = false;
  for (;;) {
    const [{ locked }] = await sql<{ locked: boolean }[]>`select pg_try_advisory_lock(${LOCK_KEY}) as locked`;
    if (locked) return;
    if (Date.now() > deadline) throw new Error('Timed out waiting for another build to finish migrating.');
    if (!waited) { log('Another build is migrating; waiting.'); waited = true; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function appliedCount(sql: postgres.Sql) {
  const [{ exists }] = await sql<{ exists: boolean }[]>`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
  if (!exists) return 0;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`;
  return n;
}

main().catch((err) => {
  // Message only: connection errors can echo the host, never the password.
  console.error(`[db:migrate] Failed: ${(err as Error).message}`);
  process.exit(1);
});
