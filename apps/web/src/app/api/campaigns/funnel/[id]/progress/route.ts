import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { FunnelService } from "@outreachos/services";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const funnel = await FunnelService.getById(account.id, id);

    if (!funnel) {
      return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
    }

    const progress = await FunnelService.getProgress(account.id, id);
    return NextResponse.json({ data: progress });
  } catch (error) {
    console.error("Funnel progress error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
