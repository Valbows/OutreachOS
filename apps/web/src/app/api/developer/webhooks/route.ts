/**
 * Developer Webhooks API
 * GET /api/developer/webhooks — list webhooks
 * POST /api/developer/webhooks — create webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { WebhookService } from "@outreachos/services";
import { z } from "zod";

const webhookEvents = [
  "email.sent",
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "contact.created",
  "contact.updated",
  "campaign.started",
  "campaign.completed",
] as const;

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(webhookEvents)).min(1),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhooks = await WebhookService.list(account.id);
    return NextResponse.json({ webhooks });
  } catch (err) {
    console.error("Webhooks list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const webhook = await WebhookService.create({
      accountId: account.id,
      url: parsed.data.url,
      events: parsed.data.events,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    console.error("Webhook create error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
