// Applies every migration in drizzle/ that the database hasn't had yet.
//   DATABASE_URL=postgres://… npm run db:migrate
// Run it once after adding Neon, and again whenever a new migration lands.
// Already-applied migrations are skipped, so running it twice is harmless.
import { openDb } from '../src/lib/db/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first (vercel env pull .env.local, or a pglite: path).');
  process.exit(1);
}
async function main() {
  const handle = await openDb(url, { migrate: true });
  await handle.close();
  console.log(`Migrations applied (${handle.kind}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
