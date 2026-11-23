# Environments and releasing

Three places the site runs, each with its own data.

| | Production | Staging | Local |
| --- | --- | --- | --- |
| Address | www.constelier.com | staging.constelier.com | localhost:3000 |
| Git | `production` branch | `main` branch | your working copy |
| Vercel environment | Production | Preview | none |
| Database | Neon store `neon-citron-curtain` | Neon store `constelier-staging` | pglite (`.data/pglite`) |
| Stripe | none yet (shop is off) | sandbox key | your `.env.local` |

Pull-request previews are the same environment as staging: every preview,
`main` included, shares the one staging database. There is no database per
branch (Neon's free plan allows 10 branches and they ran out within a week).
A PR with a migration therefore changes the staging schema as soon as its
preview builds, so keep unmerged migrations additive.

The two databases are separate Neon projects, each connected through
Vercel's Storage tab: `neon-citron-curtain` to Production only,
`constelier-staging` to Preview only. Vercel sets `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` for each; nothing is pasted by hand.

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

- Staging's database starts empty and holds only what you create there. It
  is never copied from production, so no real customer or waitlist details
  reach it.
- To add sample rows, run the seed script against the staging connection
  string (Vercel → Storage → `constelier-staging` → `.env.local` tab):
  `DATABASE_URL=… npm run db:seed -- --allow-remote`. Never point it at
  `neon-citron-curtain`.
- To rehearse a risky migration on real-shaped data, make a temporary branch
  of production in the Neon console, run `npm run db:migrate` against that
  branch's connection string, then delete the branch.

## The admin panel

One panel, on the live site at `/admin`, with a switch between production's
data and staging's. See docs/quotes-admin.md.

## Things that are shared

- Design thumbnails: one Vercel Blob store for every environment.
- Vercel Analytics records previews too, but its dashboard filters by
  environment and shows production by default.
- staging.constelier.com sits behind Vercel's login (Deployment Protection
  covers preview deployments, this address included), so only you can open
  it. Anything outside that must call staging, such as a Stripe webhook,
  needs a protection bypass set up in Vercel first. It also asks not to be
  indexed (`src/app/robots.ts`).
