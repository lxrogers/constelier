# Switching on orders, policies and analytics

Everything below is code-only until you do these steps. Nothing here was set
up in your accounts.

## Order database (needed before orders are saved)
1. Vercel project → Storage → Create Database → Neon. Connect it to
   Production, Preview and Development. That sets `DATABASE_URL`.
2. Vercel project → Storage → Create → Blob. Connect it the same way. That
   sets `BLOB_READ_WRITE_TOKEN` (design thumbnails).
3. On your Mac: `vercel env pull .env.local`, then `npm run db:migrate`.
4. Redeploy, run one test-mode checkout, and check one row lands in `orders`
   (Neon console → Tables). Resend the webhook event from the Stripe
   dashboard and check no second row appears.

Until step 1, the shop behaves exactly as before (orders logged, designs in
Stripe metadata). Details: docs/orders-database.md.

## Policies
- Fill in and confirm the values in `src/app/legal/policy.ts`
  (list: docs/policy-decisions.md), then set `LEGAL_DRAFT = false`.
- Have a lawyer read them before launch. They are drafts, not legal advice.

## Analytics and speed
1. Vercel project → Analytics → Enable (Web Analytics).
2. Vercel project → Speed Insights → Enable.
3. Funnel events (birth_details_entered, chart_shown, outline_changed,
   quote_shown, added_to_bag, checkout_started, waitlist_joined) appear under
   Analytics → Events. Custom events need a Pro plan; page views work on Hobby.

## Error alerts
- Errors are always in the Vercel logs. For pings, create a Slack or Discord
  incoming webhook and add its URL as `ALERT_WEBHOOK_URL` in the Vercel
  project's environment variables. Alerts cover server errors, browser
  crashes and any paid order that couldn't be saved.
