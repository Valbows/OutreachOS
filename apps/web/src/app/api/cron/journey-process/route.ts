import { NextRequest, NextResponse } from "next/server";
import { JourneyService } from "@outreachos/services";

/** Vercel Cron endpoint — processes due journey sends every 5 minutes */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized invocations — fail closed
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
          { error: "Cron secret not configured" },
          { status: 500 }
        );
      }
      console.warn("CRON_SECRET not set — allowing request in development mode");
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      console.error("Journey cron: missing RESEND_API_KEY or FROM_EMAIL");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const stats = await JourneyService.processDueSends({
      resendApiKey,
      fromEmail,
      fromName: process.env.FROM_NAME,
      replyTo: process.env.REPLY_TO_EMAIL,
    });

    console.log("Journey cron completed:", stats);
    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error("Journey cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
