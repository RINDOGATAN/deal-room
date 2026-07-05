/**
 * Webhook Delivery Service
 *
 * Delivers events to registered webhook endpoints with HMAC-SHA256 signing.
 * Uses fire-and-forget delivery with 3 retry attempts and exponential backoff.
 */

import { createHmac } from "crypto";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-webhooks");

export type WebhookEventType =
  | "negotiation.pending"
  | "negotiation.agreed"
  | "negotiation.failed"
  | "negotiation.suggested"
  | "negotiation.counter";

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverWithRetry(
  url: string,
  payload: string,
  signature: string,
  attempt = 1
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dealroom-Signature": `sha256=${signature}`,
        "X-Dealroom-Event": JSON.parse(payload).event,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
      return deliverWithRetry(url, payload, signature, attempt + 1);
    }
  } catch (err) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return deliverWithRetry(url, payload, signature, attempt + 1);
    }
    logger.error("Webhook delivery failed after 3 attempts", { url, err: String(err) });
  }
}

/**
 * Fire webhook events to all matching endpoints for a customer.
 * This is fire-and-forget — it does not block the caller.
 */
export async function fireWebhook(
  customerId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      customerId,
      isActive: true,
      events: { has: event },
    },
  });

  if (endpoints.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadStr = JSON.stringify(payload);

  for (const endpoint of endpoints) {
    const signature = signPayload(payloadStr, endpoint.secret);
    // Fire and forget — don't await
    deliverWithRetry(endpoint.url, payloadStr, signature).catch(() => {});
  }
}
