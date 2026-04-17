/**
 * REST API v1 - Campaign Stats
 * GET /api/v1/campaigns/[id]/stats — get campaign performance metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { CampaignService, AnalyticsService } from "@outreachos/services";

async function handleGet(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
  }

  // Verify campaign exists and belongs to account
  const campaign = await CampaignService.getById(ctx.accountId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const metrics = await AnalyticsService.getCampaignMetrics(id);
  return NextResponse.json({ data: metrics });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));

export async function GET(req: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return getHandler(req, { params: routeCtx.params });
}
