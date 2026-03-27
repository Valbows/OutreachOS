import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ExperimentService } from "@outreachos/services";

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
    const summary = await ExperimentService.getSummary(account.id, id);
    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Experiment get error:", error);
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
    await ExperimentService.delete(account.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Experiment delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
