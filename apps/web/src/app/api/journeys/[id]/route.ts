import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { z } from "zod";

const enrollSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(1000),
  removeOnReply: z.boolean().optional(),
  removeOnUnsubscribe: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const journey = await JourneyService.getById(account.id, id);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const progress = await JourneyService.getProgress(id);
    return NextResponse.json({ data: { ...journey, progress } });
  } catch (error) {
    console.error("Journey get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await JourneyService.delete(account.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Journey delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
