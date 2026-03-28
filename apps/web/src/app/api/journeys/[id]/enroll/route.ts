import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { z } from "zod";

const enrollSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(1000),
  removeOnReply: z.boolean().optional(),
  removeOnUnsubscribe: z.boolean().optional(),
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = await params;

    // Verify journey belongs to account
    const journey = await JourneyService.getById(account.id, id);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const contactList = parsed.data.contactIds.map((cid) => ({ id: cid }));
    const result = await JourneyService.enrollGroup(id, contactList, {
      removeOnReply: parsed.data.removeOnReply,
      removeOnUnsubscribe: parsed.data.removeOnUnsubscribe,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("Journey enroll error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
