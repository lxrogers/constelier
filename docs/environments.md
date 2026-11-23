# Environments and releasing

Three places the site runs, each with its own data.

| | Production | Staging | Local |
| --- | --- | --- | --- |
| Address | www.constelier.com | staging.constelier.com | localhost:3000 |
| Git | `production` branch | `main` branch | your working copy |
| Vercel environment | Production | Preview | none |
| Database | Neon default branch | Neon branch `preview/main` | pglite (`.data/pglite`) |
| Stripe | none yet (shop is off) | sandbox key | your `.env.local` |
| `NEXT_PUBLIC_SHOP_ENABLED` | unset: waitlist | `true`: bag and checkout | your `.env.local` |

Pull-request previews work like staging, each on its own Neon branch
(`preview/<git branch>`), made by the Neon integration on first deploy.

## Day to day

- Merge to `main`. Vercel builds it as a preview and staging.constelier.com
  shows it. Nothing reaches production.
- Test on staging. Signups, accounts and orders made there land in the
  staging database only.

## Releasing

```
npm run release
```

This moves the `production` branch up to `main` (a fast-forward push, so it
refuses if `production` has commits `main` lacks). Vercel then builds a
production deployment, which applies any new migration to the production
database. While "Auto-assign Custom Production Domains" is off in the Vercel
project, that build still waits: promote it in the Vercel dashboard to put it
on www.constelier.com. Turn the setting on to make the push itself the
release.

Because the migration runs when the production build does, and the old code
keeps serving until the new build is promoted, keep migrations additive: add
the new column or table first, and drop old ones in a later release.

To roll back, use Instant Rollback on the previous production deployment in
Vercel. It does not undo a migration.

## Staging data

- Staging's database starts as a copy of production taken when the
  `preview/main` Neon branch was first made, and drifts from there.
- To refresh it from production (for example to rehearse a risky migration
  on real-shaped data): Neon console → Branches → `preview/main` → Reset
  from parent. Staging's own rows are lost.
- To add sample rows, run the seed script against the staging branch's
  connection string (from the Neon console):
  `DATABASE_URL=… npm run db:seed -- --allow-remote`. Never point it at
  the default branch.
- A refresh copies real customer and waitlist emails into staging. Before
  the site sends any email, make non-production sends go only to an
  allowlist of your own addresses.

## Things that are shared

- Design thumbnails: one Vercel Blob store for every environment.
- Vercel Analytics records previews too, but its dashboard filters by
  environment and shows production by default.
- staging.constelier.com sits behind Vercel's login (Deployment Protection
  covers preview deployments, this address included), so only you can open
  it. Anything outside that must call staging, such as a Stripe webhook,
  needs a protection bypass set up in Vercel first. It also asks not to be
  indexed (`src/app/robots.ts`).
