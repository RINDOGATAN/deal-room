// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Trimmed Stripe payloads for the pay-per-contract webhook tests. Only the
 * fields the handlers read are kept; ids are fictitious.
 */
import type Stripe from "stripe";

export const contractSessionPaid = {
  id: "cs_test_contract_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  amount_total: 2900,
  currency: "eur",
  payment_intent: "pi_test_contract_1",
  subscription: null,
  metadata: { kind: "contract", dealRoomId: "deal_1", customerId: "cust_1", userId: "user_1" },
} as unknown as Stripe.Checkout.Session;

export const contractSessionUnpaid = {
  ...contractSessionPaid,
  id: "cs_test_contract_async",
  payment_status: "unpaid",
  payment_intent: "pi_test_contract_async",
} as unknown as Stripe.Checkout.Session;

export const creditsSessionPaid = {
  id: "cs_test_credits_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  amount_total: 26100,
  currency: "usd",
  payment_intent: "pi_test_credits_1",
  subscription: null,
  metadata: { kind: "credits", apiKeyId: "key_1", customerId: "cust_2", credits: "10" },
} as unknown as Stripe.Checkout.Session;

export const planSessionComplete = {
  id: "cs_test_plan_1",
  object: "checkout.session",
  mode: "subscription",
  payment_status: "paid",
  subscription: "sub_test_plan_1",
  metadata: { kind: "plan", customerId: "cust_3", userId: "user_3" },
} as unknown as Stripe.Checkout.Session;

export const planSubscriptionActive = {
  id: "sub_test_plan_1",
  object: "subscription",
  status: "active",
  metadata: { kind: "plan", customerId: "cust_3" },
  items: {
    data: [{ current_period_start: 1790000000, current_period_end: 1792592000 }],
  },
} as unknown as Stripe.Subscription;

export const legacySkillSession = {
  id: "cs_test_legacy",
  object: "checkout.session",
  mode: "subscription",
  metadata: { customerId: "cust_4", skillPackageIds: "pkg_1" },
} as unknown as Stripe.Checkout.Session;

export const chargeFullyRefunded = {
  id: "ch_test_1",
  object: "charge",
  refunded: true,
  amount_refunded: 2900,
  payment_intent: "pi_test_contract_1",
} as unknown as Stripe.Charge;

export const chargePartiallyRefunded = {
  ...chargeFullyRefunded,
  id: "ch_test_2",
  refunded: false,
  amount_refunded: 500,
} as unknown as Stripe.Charge;

export const creditsChargeRefunded = {
  id: "ch_test_3",
  object: "charge",
  refunded: true,
  payment_intent: "pi_test_credits_1",
} as unknown as Stripe.Charge;
