import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ExperimentService } from "@outreachos/services";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(["subject_line", "body_cta"]),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const experiments = await ExperimentService.list(account.id);
    return NextResponse.json({ data: experiments });
  } catch (error) {
    console.error("Experiment list error:", error);
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
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
      }
      throw err;
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify campaign ownership before creating experiment
    const campaign = await CampaignService.getById(account.id, parsed.data.campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 403 });
    }

    const experiment = await ExperimentService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: experiment }, { status: 201 });
  } catch (error) {
    console.error("Experiment create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
