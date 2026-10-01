# Billing: pay per contract

Owner decisions of 29 September 2026 (round 1, then the six answers of
round 2). This page explains how Dealroom charges when payments are on,
which variables switch it on, and what to set up in Stripe. The self-hosted
kit is not affected: payments stay off there and every contract is free.

## What is paid, and when

- **Drafting and negotiating are free**, whatever the template. That covers
  deal creation, selections, counter-offers, the compromise suggestions and
  the on-screen preview of the contract.
- **A contract is paid at the moment of value**: the first download (PDF,
  DOCX or TXT) or the start of the signature. The price is the same for
  every template; premium skills are included in it. There is no price per
  skill, no yearly skill price and **no monthly plan** (the plan was
  discarded before launch).
- Either party to a deal may pay. Once paid, the deal is paid for both
  parties, for every format, for good.
- **Agents** pay the same way, through **prepaid credits** sold in packs of
  ten at 25 percent off. The discount is carried by the Stripe price itself;
  the code only sells "one pack of ten". One credit is spent the first time
  an agent fetches the document of an agreed deal.
- **Credits belong to the customer** (the organisation or person that owns
  the API keys), not to a key. Any key of the customer spends from the one
  balance; rotating or revoking a key changes nothing. The ledger notes
  which key bought or spent each credit, for the record only.
- Unpaid downloads and signature starts answer **HTTP 402** with a plain
  message and where to pay (`/api/deals/:id/checkout` for people,
  `/api/v1/agent/credits/checkout` for agents).
- **Billing start.** `CONTRACT_BILLING_START` (an ISO date, set to the deploy
  date) is required. Every deal created before it is never charged; as a
  deal cannot be agreed before it exists, this covers every deal agreed
  before the start. Deals created after it pay at download or signature.
  (Dealroom records no agreement date, so a deal created before the start
  but agreed after it is also left free: the conservative side.) Deals that
  were already in signature or completed are never charged either.
- **No revenue share** on per-contract payments: they create no
  `revenue_events` row and no transfer. Revenue events remain only for the
  earlier per-skill subscriptions. The marketplace stays as the catalogue
  of our own add-ons.
- **Refunds.** A full refund reverts what the payment bought (the contract
  is unpaid again, or the pack is taken back). A partial refund keeps the
  entitlement.
- The standalone transfer impact assessment (`/api/deals/:id/tia`) and the
  supervising attorney's copies (`/api/supervise/...`) are not charged.
- The former purchase routes answer **HTTP 410** with a plain message:
  `POST /api/checkout` (per-skill purchase, then the plan) and
  `POST /api/v1/agent/subscribe` (and its old alias
  `POST /api/checkout/credits`).

No amount is written in the code. Stripe charges what its price says. The
amounts shown to people and in the agent card come from
`PRICE_DISPLAY_CONTRACT` / `PRICE_DISPLAY_CREDITS_10` when set, otherwise
from the Stripe prices the variables point to. To change a price, create a
new Stripe price, point the variable at it, and update the display variable.

## The variables

| Variable | What it is |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (server). |
| `NEXT_PUBLIC_STRIPE_ENABLED=true` | Client signal that payments are on. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint below. |
| `STRIPE_PRICE_CONTRACT_USD` | One contract, one-off price, US dollars. |
| `STRIPE_PRICE_CONTRACT_EUR` | One contract, one-off price, euros. |
| `STRIPE_PRICE_CREDITS_10_USD` | Pack of ten agent credits, one-off price, US dollars. |
| `STRIPE_PRICE_CREDITS_10_EUR` | Pack of ten agent credits, one-off price, euros. |
| `CONTRACT_BILLING_START` | Required. ISO date (for example `2026-10-01`), the deploy date. Deals created before it are never charged. |
| `PRICE_DISPLAY_CONTRACT` | Optional. The amount to show for one contract, for example `29`. A plain number is shown in the reader's currency ("$29", "29 €"); other text is shown as written. |
| `PRICE_DISPLAY_CREDITS_10` | Optional. The amount to show for a pack of ten, for example `217.50`. |

### Which currency a person sees (2026-10-01)

One currency per visitor, never both. Euros for a visitor in the EU, the
EEA, the United Kingdom or Switzerland; dollars for everyone else. The
region comes from the `x-vercel-ip-country` header, else the region of the
`Accept-Language` header, else dollars (`src/lib/currency.ts`). A signed-in
customer's stored billing currency (`Customer.metadata.preferredCurrency`,
written at checkout) wins over the region guess, and the quiet "Prices in
USD" / "Precios en EUR" link wins over both for the browser session
(cookie `currency_choice`). The pricing page's structured data, the agent
card and `llms.txt` keep both amounts.

`STRIPE_PRICE_MONTHLY_USD` and `STRIPE_PRICE_MONTHLY_EUR` are no longer read.
If they are set on the deployment they can be removed.

### The five variables that switch billing on

On the hosted deployment the Stripe key alone does **not** switch billing
on. Billing starts only when all five are set: the four prices
(`STRIPE_PRICE_CONTRACT_USD`, `STRIPE_PRICE_CONTRACT_EUR`,
`STRIPE_PRICE_CREDITS_10_USD`, `STRIPE_PRICE_CREDITS_10_EUR`) and a valid
`CONTRACT_BILLING_START` date. They must be present **at build time** as
well as at run time, because the build inlines the answer into the browser
bundle (`NEXT_PUBLIC_CONTRACT_BILLING`). Until then, hosted stays the free
pilot with its limits. Deploying the code does not switch billing on by
itself, and a start date that is not a date keeps billing off.

When billing is on:

- the pilot mechanics go: the 90-day edit window, the record ceilings, the
  read-only state and the Settings counters are skipped;
- the confidentiality cautions stay everywhere they were (hosted Dealroom
  offers no contractual safeguards; do not enter privileged or
  confidential information);
- `/billing` is available (price, receipts, and cancellation of any earlier
  per-skill subscription), and the marketplace lists every skill as part of
  the catalogue with no per-skill purchase.

## Stripe setup

### Prices (four)

Create, on the tech firm's Stripe account:

1. Product "Dealroom contract": a one-off price in USD and one in EUR.
2. Product "Dealroom agent credits (10)": a one-off price in USD and one in
   EUR, for ten contracts at 25 percent off (217.50 in each currency when
   the contract is 29).

Put the four price ids in the variables above. No recurring price is
needed.

### Webhook endpoint (re-enable)

The account's webhook endpoint must point at

```
https://dealroom.todo.law/api/webhooks/stripe
```

and send at least these events:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
charge.refunded
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

The `customer.subscription.*` and `invoice.*` events serve only the earlier
per-skill subscribers, whose webhook handling is unchanged. Its signing
secret goes in `STRIPE_WEBHOOK_SECRET`. The handler records each event id
once (`stripe_webhook_events`), so redeliveries are harmless.

### Customer portal

`/billing` → "Receipts and payment details" opens the Stripe customer
portal for anyone who has paid before. Earlier per-skill subscribers can
also cancel there (or from `/billing` directly). The portal must be enabled
in the Stripe dashboard (Settings → Billing → Customer portal), with
cancellation allowed.

## How it is stored

- `deal_payments`: one row per payment that makes a deal paid. `kind` is
  `CONTRACT` (one-off payment) or `CREDIT` (agent credit); `status` is
  `PAID` or `REVOKED`. A full refund or a failed delayed payment marks the
  row `REVOKED`, and the deal is unpaid again. A partial refund keeps the
  entitlement. (The `PLAN` kind remains in the enum but is never written.)
- `customer_credits` and `customer_credit_entries`: the balance per
  customer and its ledger (`PURCHASE` +10, `CONSUME` -1, `REVERSAL` -10 on
  refund), each entry with the key that bought or spent it. A refunded pack
  is taken back even if some credits were already spent; the balance can
  then go below zero, which blocks new spending.
- `agent_credits`, `agent_credit_entries` (credits per key, round 1) and
  `contract_plans` (the discarded plan) stay in the schema, unused.
  Migrations are append-only; the round-2 migration copies any per-key
  balance into the customer's.

Two paths record a payment, and both are idempotent: the webhook, and the
return from checkout (`/api/checkout/activate`), which lets the download
unlock as soon as the person lands back on the deal.

## Storefront lines

The storefront (todo.law, separate repository) should carry these lines for
hosted Dealroom:

- "From $29 per contract" (and "Desde 29 € por contrato").
- For agents: "Credits in packs of ten, 25 percent off" (and "Créditos en
  packs de diez, con un 25 % de descuento").

The amounts above are the owner's decision at the time of writing; the
product itself reads them from the display variables or from Stripe.
