/**
 * Webhook Service - Outbound webhook delivery with retry logic
 */

import { db, webhooks, webhookDeliveries } from "@outreachos/db";
import { eq, and, lte, isNull } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type WebhookEvent =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"
  | "contact.created"
  | "contact.updated"
  | "campaign.started"
  | "campaign.completed";

export interface CreateWebhookInput {
  accountId: string;
  url: string;
  events: WebhookEvent[];
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 14400]; // 1min, 5min, 15min, 1hr, 4hr

export class WebhookService {
  /**
   * Create a new webhook endpoint
   */
  static async create(input: CreateWebhookInput) {
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    
    const [webhook] = await db
      .insert(webhooks)
      .values({
        accountId: input.accountId,
        url: input.url,
        secret,
        events: input.events,
        enabled: 1,
      })
      .returning();

    return { ...webhook, secret };
  }

  /**
   * List webhooks for an account
   */
  static async list(accountId: string) {
    return db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        enabled: webhooks.enabled,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.accountId, accountId))
      .orderBy(webhooks.createdAt);
  }

  /**
   * Get a single webhook by ID
   */
  static async get(accountId: string, webhookId: string) {
    const [webhook] = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        enabled: webhooks.enabled,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.accountId, accountId)))
      .limit(1);

    return webhook ?? null;
  }

  /**
   * Update a webhook
   */
  static async update(
    accountId: string,
    webhookId: string,
    data: { url?: string; events?: WebhookEvent[]; enabled?: boolean }
  ) {
    const [updated] = await db
      .update(webhooks)
      .set({
        ...(data.url && { url: data.url }),
        ...(data.events && { events: data.events }),
        ...(data.enabled !== undefined && { enabled: data.enabled ? 1 : 0 }),
        updatedAt: new Date(),
      })
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.accountId, accountId)))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a webhook
   */
  static async delete(accountId: string, webhookId: string) {
    await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.accountId, accountId)));
  }

  /**
   * Dispatch an event to all matching webhooks
   */
  static async dispatch(accountId: string, event: WebhookEvent, data: Record<string, unknown>) {
    const matchingWebhooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.accountId, accountId), eq(webhooks.enabled, 1)));

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of matchingWebhooks) {
      const events = webhook.events as WebhookEvent[];
      if (!events.includes(event)) continue;

      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        event,
        payload,
        attempts: 0,
        nextRetryAt: new Date(),
      });
    }
  }

  /**
   * Process pending webhook deliveries
   */
  static async processPendingDeliveries() {
    const now = new Date();
    
    const pending = await db
      .select({
        delivery: webhookDeliveries,
        webhook: webhooks,
      })
      .from(webhookDeliveries)
      .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
      .where(
        and(
          isNull(webhookDeliveries.deliveredAt),
          lte(webhookDeliveries.attempts, MAX_RETRIES),
          lte(webhookDeliveries.nextRetryAt, now)
        )
      )
      .limit(100);

    for (const { delivery, webhook } of pending) {
      await WebhookService.attemptDelivery(delivery, webhook);
    }

    return pending.length;
  }

  /**
   * Attempt to deliver a webhook
   */
  private static async attemptDelivery(
    delivery: typeof webhookDeliveries.$inferSelect,
    webhook: typeof webhooks.$inferSelect
  ) {
    const payload = JSON.stringify(delivery.payload);
    const signature = WebhookService.sign(payload, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Id": delivery.id,
          "X-Webhook-Timestamp": new Date().toISOString(),
        },
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });

      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
        await db
          .update(webhookDeliveries)
          .set({
            statusCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            deliveredAt: new Date(),
            attempts: delivery.attempts + 1,
          })
          .where(eq(webhookDeliveries.id, delivery.id));
      } else {
        await WebhookService.scheduleRetry(delivery, response.status, responseBody);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await WebhookService.scheduleRetry(delivery, 0, errorMessage);
    }
  }

  /**
   * Schedule a retry for a failed delivery
   */
  private static async scheduleRetry(
    delivery: typeof webhookDeliveries.$inferSelect,
    statusCode: number,
    responseBody: string
  ) {
    const attempts = delivery.attempts + 1;
    const nextRetryAt =
      attempts <= RETRY_DELAYS.length
        ? new Date(Date.now() + RETRY_DELAYS[attempts - 1] * 1000)
        : null;

    await db
      .update(webhookDeliveries)
      .set({
        statusCode,
        responseBody: responseBody.slice(0, 1000),
        attempts,
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, delivery.id));
  }

  /**
   * Sign a payload with HMAC-SHA256
   */
  static sign(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Verify a webhook signature
   */
  static verify(payload: string, signature: string, secret: string, tolerance = 300): boolean {
    const parts = signature.split(",").reduce(
      (acc, part) => {
        const [key, value] = part.split("=");
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const timestamp = parseInt(parts.t, 10);
    if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > tolerance) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const bufExpected = Buffer.from(expectedSignature, "hex");
    const bufActual = Buffer.from(parts.v1 || "", "hex");
    if (bufExpected.length !== bufActual.length) {
      return false;
    }
    return timingSafeEqual(bufExpected, bufActual);
  }
}
