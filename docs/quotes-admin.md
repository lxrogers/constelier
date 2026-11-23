# Quote requests, pendant pages and the admin panel

How a request becomes an order, and what has to be switched on for each part.

## The flow

1. **Request.** The configurator's last step posts to `/api/quote-requests`.
   That saves the customer (found by email or phone, or added), their design
   and a `quote_requests` row, and pings `ALERT_WEBHOOK_URL` if it is set.
2. **Conversation.** In `/admin` you read the request and write back by email
   or text. Every message either way is a row in `messages`.
3. **Pendant page.** "Start pendant page" makes a draft offer filled in from
   the request. You add a note, sizes, a price for each metal at each size and
   photos, then publish. The page is `/pendant/<offer id>`; the id is random,
   so the link is what gives access. Until photos are added it shows the
   snapshot from the customer's design.
4. **Payment.** The page's Add to bag leads to the normal Stripe checkout,
   priced from the offer on the server. When the payment lands, the order is
   linked to the offer and its customer, and the request becomes "Paid".

Request statuses: New → Contacted (first message sent) → Offer sent (a
message containing the pendant page link) → Paid. You can also set any of
them, or Closed, by hand.

## Tables (migration `drizzle/0001_quote_requests_offers.sql`)

| Table | What changed |
| --- | --- |
| `customers` | `email` is optional (someone who asked by text has none until they pay); `phone` is indexed |
| `quote_requests` | new: customer, design, preferred channel, status, private notes |
| `offers` | new: the pendant page's content, `draft` or `published` |
| `messages` | belongs to a customer (order and request are optional); has a direction and a sender |
| `orders` | optional `offer_id` |

## The admin panel

- Lives at `/admin`, behind one password: `ADMIN_PASSWORD` (12 characters or
  more). Without it every admin page is a 404. Sign-in lasts 30 days.
- The address names the data being shown: `/admin/production` or
  `/admin/staging`. On the live site the header has a switch between them,
  which appears once `STAGING_DATABASE_URL` is set in the Production
  environment. On staging itself, or on a laptop, there is only that site's
  own data.
- In the staging view, messages only go to `MESSAGE_ALLOWLIST`, and pendant
  page links point at staging.constelier.com.
- Staging's database can be a migration ahead of the live code. Keep
  migrations additive (see docs/environments.md) and the panel keeps working.

## Switching things on

Nothing below is set up yet. Each is independent.

### Admin panel
1. Vercel → Environment Variables → add `ADMIN_PASSWORD` to Production (and
   to Preview if you want `/admin` on staging too).
2. To see staging from the live site: Vercel → Storage → `constelier-staging`
   → Connect to Project → Production, with the custom prefix `STAGING`, so
   Production gets `STAGING_DATABASE_URL`. If Vercel will not connect one
   store to a project twice, copy the staging connection string into a
   Production variable of that name by hand.

### Email (Twilio SendGrid)
1. SendGrid → Settings → Sender Authentication: authenticate the sending
   domain (DNS records).
2. Create an API key with Mail Send permission → `SENDGRID_API_KEY`. Set
   `MESSAGE_FROM_EMAIL` to an address on that domain.
3. For replies: add an MX record for a subdomain (for example
   `mail.constelier.com`) pointing at `mx.sendgrid.net`, then SendGrid →
   Settings → Inbound Parse → add that host with the destination
   `https://www.constelier.com/api/messaging/email/inbound?key=<secret>`.
   Put the same secret in `INBOUND_EMAIL_SECRET` (16 characters or more) and
   the subdomain in `MESSAGE_REPLY_DOMAIN`.
4. A reply is filed only if it comes from a known customer or is addressed to
   their own `reply+…` address. Mail from anyone else is not saved; a notice
   goes to `ALERT_WEBHOOK_URL`. Attachments are not kept.

### Texts (Twilio)
1. Buy a number and register it for business texting (A2P 10DLC).
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`
   (or `TWILIO_MESSAGING_SERVICE_SID`).
3. On the number (or Messaging Service), set "A message comes in" to
   `https://www.constelier.com/api/messaging/twilio/inbound` (HTTP POST).
   Requests are checked against Twilio's signature. A text from a number
   that is not a customer yet adds one, so it can be answered.
4. Delivery updates arrive at `/api/messaging/twilio/status` on their own.

Webhooks point at the live site only: staging sits behind Vercel's login, so
Twilio and SendGrid cannot reach it. A reply from someone who only exists in
staging's data is still filed there, because the live site looks in both.

### Not built yet
- Email delivery status (bounces, opens). Texts have it.
- Message templates (`message_templates` is still unused).
- Order stages in the admin panel; it lists a customer's orders only.

## Local

```
echo 'DATABASE_URL=pglite:./.data/pglite' >> .env.local
echo 'ADMIN_PASSWORD=<12 or more characters>' >> .env.local
npm run dev            # http://localhost:3000/admin
npm run db:seed        # optional: a sample request and order (stop dev first)
npm test
```

Without the provider keys the composer says the channel is not set up and
sends nothing. Photos need the Blob store, so they are off locally too.
