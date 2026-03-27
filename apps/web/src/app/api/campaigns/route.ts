import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["one_time", "journey", "funnel", "ab_test", "newsletter"]),
  groupId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const VALID_STATUSES = ["draft", "active", "paused", "completed", "stopped"] as const;
    type CampaignStatus = (typeof VALID_STATUSES)[number];

    const rawStatus = request.nextUrl.searchParams.get("status");
    const status: CampaignStatus | undefined = VALID_STATUSES.includes(rawStatus as CampaignStatus)
      ? (rawStatus as CampaignStatus)
      : undefined;

    const campaigns = await CampaignService.list(account.id, status);
    return NextResponse.json({ data: campaigns });
  } catch (error) {
    console.error("Campaign list error:", error);
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

    const campaign = await CampaignService.create({
      accountId: account.id,
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
