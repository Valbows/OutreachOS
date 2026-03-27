import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  fromEmail: z.string().email(),
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

    // Stream progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await CampaignService.sendCampaign(
            account.id,
            id,
            {
              resendApiKey,
              fromEmail: parsed.data.fromEmail,
              fromName: parsed.data.fromName,
              replyTo: parsed.data.replyTo,
            },
            (progress) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
              );
            },
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ...result, done: true })}\n\n`),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Send failed";
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
