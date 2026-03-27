import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CampaignService, AnalyticsService } from "@outreachos/services";

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

    // Verify campaign belongs to account
    const campaign = await CampaignService.getById(account.id, id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const [metrics, hourly, daily] = await Promise.all([
      AnalyticsService.getCampaignMetrics(id),
      AnalyticsService.getHourlyMetrics(id),
      AnalyticsService.getDailyMetrics(id),
    ]);

    return NextResponse.json({ data: { metrics, hourly, daily } });
  } catch (error) {
    console.error("Campaign analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
