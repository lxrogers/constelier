import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` diffs src/lib/db/schema.ts against drizzle/ and writes
// a new SQL migration there. Generating needs no database connection.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
});
