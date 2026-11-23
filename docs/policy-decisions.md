# Policy decisions to make

The pages at /legal/* are live (`LEGAL_DRAFT = false` since November 23,
2026, so Twilio's text-message review can read them). Every value lives in
`src/app/legal/policy.ts`. A `confirm()` value is a suggestion that now reads
as plain text; a sentence whose value is still a `fill()` is left out of the
page until you fill it in. Set `LEGAL_DRAFT = true` locally to see every blank
and suggestion marked. They are not legal advice and have not been read by a
lawyer.

Decided: business name (Constelier, LLC), contact email, and a city-only
mailing address. Still undecided, and so not shown: governing state, carrier,
the lost-package rule, the chain line, repairs after the warranty, and what
works today for accessibility.

## Who you are
- Business legal name (LLC, or your name doing business as Constelier)
- Mailing address to publish (a PO box or virtual address works)
- Contact email, e.g. hello@constelier.com
- Governing state, probably New York
- Minimum age to order (suggested 18, or younger with a guardian)

## Orders and final sale
- One rule used everywhere: "Each pendant is cast to order from your chart, so all sales are final." (`FINAL_SALE_SHORT`)
- Cancellation window before casting (suggested 24 hours)
- Chain: included or sold separately, length and metal
- Launch metal (14k yellow gold today)

## Shipping
- Carrier (USPS Priority, UPS, FedEx)
- Signature threshold (suggested $500, like Catbird)
- Plain outer packaging, yes or no
- Damage report window (suggested 7 days)
- What happens when a package shows delivered but is missing (refile with carrier and insurer, then remake? only after police report?)
- Production time stays 3 weeks (`SHIP_WITHIN_DAYS` in src/lib/commerce/shop-terms.ts changes checkout, bag and policies together)

## Warranty and repairs
- Warranty length (suggested one year)
- Repairs after the warranty: at cost with a quote, or not offered
- Claim window after noticing a problem (suggested 14 days)

## Privacy
- How long to keep order records with birth details (suggested seven years for tax)
- How long to keep waitlist sign-ups
- Email provider (Resend in the plan) and texting provider (Twilio), once chosen
- Reply time for privacy requests (suggested 30 days)

## Accessibility
- Test the birth form, wheel pickers, bag and checkout with a keyboard and a screen reader, then write what works today
- Whether to commit to text descriptions of aspects and the finished piece

## Not changed here
- Stripe line items still describe each pendant with its birth date and place
  ("March 10, 1994 · New York"), which shows on the checkout page and receipt.
  Metadata no longer carries birth data. Say if you'd rather the description
  be generic.
- The waitlist form under the birth form has no link to the privacy page yet;
  it sits in NatalChart.tsx, which the redesign patch also changes.
