import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { JourneyService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  groupId: z.string().uuid().optional(),
  removeOnReply: z.boolean().optional(),
  removeOnUnsubscribe: z.boolean().optional(),
  steps: z
    .array(
      z.object({
        name: z.string().min(1),
        templateId: z.string().uuid(),
        delayDays: z.number().int().min(0),
        delayHour: z.number().int().min(0).max(23).optional(),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const journeys = await JourneyService.list(account.id);
    return NextResponse.json({ data: journeys });
  } catch (error) {
    console.error("Journey list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const journey = await JourneyService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: journey }, { status: 201 });
  } catch (error) {
    console.error("Journey create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
