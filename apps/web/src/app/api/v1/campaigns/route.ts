/**
 * REST API v1 - Campaigns
 * GET /api/v1/campaigns — list campaigns
 * POST /api/v1/campaigns — create campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { CampaignService, CampaignStatus } from "@outreachos/services";
import { z } from "zod";

const campaignStatuses = ["draft", "active", "paused", "completed", "stopped"] as const;

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["one_time", "journey", "funnel", "ab_test", "newsletter"]).optional(),
  groupId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
});

async function handleGet(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  const statusParam = req.nextUrl.searchParams.get("status");
  const status = statusParam && campaignStatuses.includes(statusParam as CampaignStatus)
    ? (statusParam as CampaignStatus)
    : undefined;
  const campaigns = await CampaignService.list(ctx.accountId, status);
  return NextResponse.json({ campaigns });
}

async function handlePost(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const campaign = await CampaignService.create({
    accountId: ctx.accountId,
    name: parsed.data.name,
    type: parsed.data.type ?? "one_time",
    groupId: parsed.data.groupId,
    templateId: parsed.data.templateId,
  });
  return NextResponse.json({ campaign }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
