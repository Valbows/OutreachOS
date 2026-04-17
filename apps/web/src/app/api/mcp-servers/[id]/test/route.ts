import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await McpService.test(account.id, id);

    if (!result.ok && result.error === "Server not found") {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("MCP test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
