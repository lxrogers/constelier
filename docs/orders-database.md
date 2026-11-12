# Orders database

Every paid order is saved in Postgres: the customer, the designs they bought,
the order with its totals and shipping address, one row per pendant and a
timeline event. Birth date, time and place live only in the `designs` table;
Stripe gets a `design_id` and nothing else about the person's chart.

Schema: `src/lib/db/schema.ts` (Drizzle). Migrations: `drizzle/`.

## How an order gets saved

1. **Checkout starts** (`/api/checkout`): each design in the bag is saved to
   `designs` (keyed by a hash of the design, so a repeat is a no-op). Its
   bag thumbnail goes to Vercel Blob after the response is sent. The Stripe
   line item carries only `design_id`, `metal` and `est_grams`.
2. **Payment lands**: the Stripe webhook (`/api/stripe/webhook`) and the
   success page both call `fulfillCheckout`, which calls `recordPaidOrder`.
   It upserts the customer by email, then writes the order, its items and a
   `created` event in one batch and links the designs to the customer.
3. **Repeats do nothing**: `orders.stripe_session_id` is unique. A replayed
   webhook, or the success page racing the webhook, finds the existing order.
   If the write fails, the webhook answers 500 so Stripe retries; the success
   page still shows the receipt.

Order numbers start at C1001.

## Which database

`DATABASE_URL` picks it:

| Value | Used for |
| --- | --- |
| `postgres://…neon.tech/…` | Production and previews (set by the Neon integration) |
| `pglite:./.data/pglite` | Local dev: embedded Postgres in a folder, migrated automatically |
| `pglite:memory` | Tests |
| unset | No database: orders are only logged and designs ride in Stripe metadata, as before this change |

Leaving it unset keeps today's behaviour, so nothing breaks before Neon is on.
An order paid in that mode is still saved later if its webhook is replayed
after the database is on, from the design in its Stripe metadata.

## Local

```
echo 'DATABASE_URL=pglite:./.data/pglite' >> .env.local
npm run dev
npm run db:seed     # optional: one sample order (stop the dev server first)
npm test            # order tests against an in-memory database
```

pglite allows one process per folder, so stop `npm run dev` before running the
seed script against the same folder.

## Changing the schema

```
# edit src/lib/db/schema.ts, then
npm run db:generate          # writes drizzle/000N_*.sql
npm run db:migrate           # applies it to DATABASE_URL
```

Commit the generated SQL and `drizzle/meta` with the schema change.

## Switching it on in Vercel

1. In the Vercel project: Storage → Create → Neon (Postgres). Connect it to
   Production, Preview and Development. This sets `DATABASE_URL`.
2. Storage → Create → Blob. Connect it the same way. This sets
   `BLOB_READ_WRITE_TOKEN`.
3. Locally: `vercel env pull .env.local`, then `npm run db:migrate` once.
   (Neon can give previews their own branch; migrate those too, or let
   them share the development branch.)
4. Redeploy. Start a test-mode checkout and check that one row appears in
   `orders` (Neon's console has a table viewer). Use Stripe's "Resend" on the
   webhook event and check that nothing new appears.
