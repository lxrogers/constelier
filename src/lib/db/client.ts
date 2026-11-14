import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// One database handle for the whole app, chosen by DATABASE_URL:
//
//   postgres://…neon.tech/…    Neon over HTTP (what the Vercel integration sets)
//   pglite:./.data/pglite      embedded Postgres in a local folder, for dev
//   pglite:memory              embedded Postgres in memory, for tests
//   (unset)                    no database: orders are only logged and each
//                              design rides along in Stripe metadata, as before
//
// The local pglite path applies migrations itself on first use, so `npm run
// dev` needs no setup. Neon is migrated on purpose with `npm run db:migrate`.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbKind = 'neon' | 'pglite';
export interface DbHandle { db: Db; kind: DbKind; close(): Promise<void> }

export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

const g = globalThis as typeof globalThis & { __constelierDb?: Promise<DbHandle> };

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Returns null when no database is configured.
export function getDb(): Promise<DbHandle> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Survives Next's dev reloads, so the pglite folder is opened once.
  if (!g.__constelierDb) {
    g.__constelierDb = openDb(url, { migrate: url.startsWith('pglite:') });
    g.__constelierDb.catch(() => { g.__constelierDb = undefined; });
  }
  return g.__constelierDb;
}

export async function openDb(url: string, opts: { migrate?: boolean } = {}): Promise<DbHandle> {
  if (url.startsWith('pglite:')) {
    const where = url.slice('pglite:'.length);
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const inMemory = where === 'memory' || where === '';
    if (!inMemory) (await import('node:fs')).mkdirSync(path.resolve(where), { recursive: true });
    const client = inMemory ? new PGlite() : new PGlite(path.resolve(where));
    const db = drizzle(client, { schema }) as unknown as Db;
    if (opts.migrate) {
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    return { db, kind: 'pglite', close: () => client.close() };
  }

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const db = drizzle(neon(url), { schema }) as unknown as Db;
    if (opts.migrate) {
      const { migrate } = await import('drizzle-orm/neon-http/migrator');
      await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    return { db, kind: 'neon', close: async () => {} };
  }

  throw new Error('DATABASE_URL must start with postgres://, postgresql:// or pglite:');
}

// Runs several writes all-or-nothing. Neon's HTTP driver has no interactive
// transactions, but a batch runs in one; pglite uses a normal transaction.
// `build` must only build queries, not await them.
export async function atomically(handle: DbHandle, build: (q: Db) => unknown[]) {
  if (handle.kind === 'neon') {
    const queries = build(handle.db);
    if (queries.length === 0) return;
    await (handle.db as unknown as { batch(q: unknown[]): Promise<unknown> }).batch(queries);
    return;
  }
  await handle.db.transaction(async (tx) => {
    for (const q of build(tx as unknown as Db)) await q;
  });
}

// Postgres unique-violation, through either driver.
export function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
