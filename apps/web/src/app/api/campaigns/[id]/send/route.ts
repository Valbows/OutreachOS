import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  fromEmail: z.string().email().optional(), // Optional - will use connected Gmail if not provided
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Resend API key not configured" },
        { status: 500 },
      );
    }

    // Get connected Gmail address (or use provided fromEmail as fallback)
    const [accountRecord] = await db
      .select({ gmailAddress: accounts.gmailAddress })
      .from(accounts)
      .where(eq(accounts.id, account.id))
      .limit(1);

    console.log("[Campaign Send] gmailAddress configured:", !!accountRecord?.gmailAddress);

    const fromEmail = parsed.data.fromEmail || accountRecord?.gmailAddress;
    console.log("[Campaign Send] fromEmail resolved:", !!fromEmail);

    if (!fromEmail) {
      return NextResponse.json(
        { error: "No sender email configured. Please connect your Gmail account in settings or provide a fromEmail." },
        { status: 400 },
      );
    }

    // Stream progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("[Campaign Send] Starting stream...");
          const result = await CampaignService.sendCampaign(
            account.id,
            id,
            {
              resendApiKey,
              fromEmail,
              fromName: parsed.data.fromName ?? account.name,
              replyTo: parsed.data.replyTo,
            },
            (progress) => {
              console.log("[Campaign Send] Progress:", progress);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
              );
            },
          );
          console.log("[Campaign Send] Complete:", result);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ...result, done: true })}\n\n`),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Send failed";
          console.error("[Campaign Send] Error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Campaign send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
