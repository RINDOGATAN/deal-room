# Billing: pay per contract

Owner decision of 29 September 2026. This page explains how Dealroom charges
when payments are on, which variables switch it on, and what to set up in
Stripe. The self-hosted kit is not affected: payments stay off there and
every contract is free.

## What is paid, and when

- **Drafting and negotiating are free**, whatever the template. That covers
  deal creation, selections, counter-offers, the compromise suggestions and
  the on-screen preview of the contract.
- **A contract is paid at the moment of value**: the first download (PDF,
  DOCX or TXT) or the start of the signature. The price is the same for
  every template; premium skills are included in it. There is no longer a
  price per skill, and no yearly skill price.
- Either party to a deal may pay. Once paid, the deal is paid for both
  parties, for every format, for good.
- **Monthly plan**: unlimited contracts for repeat users. Every contract
  downloaded or signed while the plan is active is recorded as covered by
  the plan and stays paid after the plan ends.
- **Agents** pay the same price per contract, through **prepaid credits**
  sold in packs of ten with a small discount. One credit is spent the first
  time an agent fetches the document of an agreed deal. An agent whose
  customer holds the monthly plan spends no credit.
- Unpaid downloads and signature starts answer **HTTP 402** with a plain
  message and where to pay (`/api/deals/:id/checkout` for people,
  `/api/v1/agent/credits/checkout` for agents).
- Deals that were already in signature or completed before billing was
  switched on are not charged. Setting `CONTRACT_BILLING_START` (an ISO
  date) also leaves free every deal created before that date.
- The standalone transfer impact assessment (`/api/deals/:id/tia`) and the
  supervising attorney's copies (`/api/supervise/...`) are not charged.

No amount is written in the code. The amounts shown to people and in the
agent card are read from the Stripe prices that the six variables point to.
To change a price, create a new Stripe price and point the variable at it.

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
| `STRIPE_PRICE_MONTHLY_USD` | Monthly plan, recurring monthly price, US dollars. |
| `STRIPE_PRICE_MONTHLY_EUR` | Monthly plan, recurring monthly price, euros. |
| `CONTRACT_BILLING_START` | Optional. ISO date; deals created before it are not charged. |

### The six variables that switch billing on

On the hosted deployment the Stripe key alone does **not** switch billing
on. Billing starts only when all six price variables are set
(`STRIPE_PRICE_CONTRACT_USD`, `STRIPE_PRICE_CONTRACT_EUR`,
`STRIPE_PRICE_CREDITS_10_USD`, `STRIPE_PRICE_CREDITS_10_EUR`,
`STRIPE_PRICE_MONTHLY_USD`, `STRIPE_PRICE_MONTHLY_EUR`), and they must be
present **at build time** as well as at run time, because the build inlines
the answer into the browser bundle (`NEXT_PUBLIC_CONTRACT_BILLING`). Until
then, hosted stays the free pilot with its limits. This means deploying the
code does not switch billing on by itself.

When billing is on:

- the pilot mechanics go: the 90-day edit window, the record ceilings, the
  read-only state and the Settings counters are skipped;
- the confidentiality cautions stay everywhere they were (hosted Dealroom
  offers no contractual safeguards; do not enter privileged or
  confidential information);
- `/billing` is available, and the marketplace lists every skill as part of
  the catalogue with no per-skill purchase.

## Stripe setup

### Prices (six)

Create, on the tech firm's Stripe account:

1. Product "Dealroom contract": a one-off price in USD and one in EUR.
2. Product "Dealroom agent credits (10)": a one-off price in USD and one in
   EUR, for ten contracts, at the chosen discount.
3. Product "Dealroom unlimited contracts": a recurring monthly price in USD
   and one in EUR.

Put the six price ids in the variables above.

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

Its signing secret goes in `STRIPE_WEBHOOK_SECRET`. The handler records each
event id once (`stripe_webhook_events`), so redeliveries are harmless.

### Customer portal

Plan holders manage the plan and download invoices through the Stripe
customer portal (`/billing` → "Manage the plan and invoices"). The portal
must be enabled in the Stripe dashboard (Settings → Billing → Customer
portal), with cancellation allowed.

## How it is stored

- `deal_payments`: one row per payment that makes a deal paid. `kind` is
  `CONTRACT` (one-off payment), `CREDIT` (agent credit) or `PLAN` (covered
  by the monthly plan); `status` is `PAID` or `REVOKED`. A full refund or a
  failed delayed payment marks the row `REVOKED`, and the deal is unpaid
  again. A partial refund keeps the entitlement.
- `agent_credits` and `agent_credit_entries`: the balance per agent API key
  and its ledger (`PURCHASE` +10, `CONSUME` -1, `REVERSAL` -10 on refund).
  A refunded pack is taken back even if some credits were already spent;
  the balance can then go below zero, which blocks new spending.
- `contract_plans`: the monthly plan per Stripe subscription, with its
  status and period. The plan covers new contracts while `active` or
  `trialing` and within the period.

Two paths record a payment, and both are idempotent: the webhook, and the
return from checkout (`/api/checkout/activate`), which lets the download
unlock as soon as the person lands back on the deal.

## Storefront lines

The storefront (todo.law, separate repository) should carry these lines for
hosted Dealroom:

- "From $29 per contract" (and "Desde 29 € por contrato").
- "Unlimited contracts: $9 / €9 a month" (and "Contratos ilimitados: 9 $ / 9 € al mes").
- For agents: "Credits in packs of ten" (and "Créditos en packs de diez").

The amounts above are the owner's decision at the time of writing; the
product itself reads them from Stripe.
