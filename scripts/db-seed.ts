// Fills a local or test database with one sample customer, design and order,
// so pages that read orders have something to show.
//   DATABASE_URL=pglite:./.data/pglite npm run db:seed
// Refuses a real Postgres URL unless you pass --allow-remote (for a Neon
// development branch, never the production one).
import { openDb } from '../src/lib/db/client';
import { recordPaidOrder, saveDesigns } from '../src/lib/commerce/orders';
import { designId } from '../src/lib/commerce/order-metadata';
import { sampleDesign, sampleSession } from './fixtures';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first, e.g. DATABASE_URL=pglite:./.data/pglite');
  process.exit(1);
}
if (!url.startsWith('pglite:') && !process.argv.includes('--allow-remote')) {
  console.error('Refusing to seed a remote database. Pass --allow-remote if this is a throwaway branch.');
  process.exit(1);
}

async function main() {
  const handle = await openDb(url, { migrate: true });
  const design = sampleDesign();
  const id = designId(design);
  await saveDesigns(handle, [{ id, design }]);
  const result = await recordPaidOrder(handle, sampleSession({ designIds: [id], sessionId: 'cs_test_seed_0001' }), 'script');
  console.log(result.status === 'skipped' ? `Skipped: ${result.reason}` : `Order C${result.number} ${result.status}.`);
  await handle.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
