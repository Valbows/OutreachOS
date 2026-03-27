import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  groupId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "stopped"]).optional(),
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
    const campaign = await CampaignService.getById(account.id, id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ data: campaign });
  } catch (error) {
    console.error("Campaign get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await CampaignService.update(account.id, id, {
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt === undefined
        ? undefined
        : parsed.data.scheduledAt === null
          ? null
          : new Date(parsed.data.scheduledAt),
    });

    if (!updated) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Campaign update error:", error);
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
    await CampaignService.delete(account.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Campaign delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
