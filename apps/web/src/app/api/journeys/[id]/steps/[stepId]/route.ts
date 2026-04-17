import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { z } from "zod";

const updateStepSchema = z.object({
  templateId: z.string().uuid().optional(),
  delayDays: z.number().int().min(0).max(365).optional(),
  delayHour: z.number().int().min(0).max(23).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
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

    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id, stepId } = await params;
    const step = await JourneyService.updateStep(account.id, id, stepId, parsed.data);

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    return NextResponse.json({ data: step });
  } catch (error) {
    console.error("Journey update step error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, stepId } = await params;
    await JourneyService.deleteStep(account.id, id, stepId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Journey delete step error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
