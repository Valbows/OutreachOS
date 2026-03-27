import { NextRequest, NextResponse } from "next/server";
import { CampaignService } from "@outreachos/services";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("svix-signature") ?? "";
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    const payload = await request.text();

    // Webhook secret must be configured
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Always validate HMAC signature
    const isValid = await CampaignService.validateWebhookSignature(
      payload,
      signature,
      webhookSecret,
    );
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(payload);
    await CampaignService.processWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
