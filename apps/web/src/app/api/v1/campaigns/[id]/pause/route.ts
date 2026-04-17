/**
 * REST API v1 - Campaign Actions
 * POST /api/v1/campaigns/[id]/pause — pause an active campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { CampaignService } from "@outreachos/services";

async function handlePost(
  req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
  }
  const updated = await CampaignService.update(ctx.accountId, id, { status: "paused" });

  if (!updated) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: updated,
    message: "Campaign paused successfully",
  });
}

const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function POST(req: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return postHandler(req, { params: routeCtx.params });
}
