import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { z } from "zod";

const createStepSchema = z.object({
  name: z.string().min(1).max(100),
  templateId: z.string().uuid().optional(),
  delayDays: z.number().int().min(0).max(365),
  delayHour: z.number().int().min(0).max(23).optional().nullable(),
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

    const parsed = createStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = await params;
    const step = await JourneyService.addStep(account.id, id, parsed.data);

    return NextResponse.json({ data: step }, { status: 201 });
  } catch (error) {
    console.error("Journey add step error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
