import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify form belongs to account
    const form = await FormService.getById(account.id, id);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Safe parsing of pagination params with bounds checking
    const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

    const rawOffset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const result = await FormService.listSubmissions(id, limit, offset);
    return NextResponse.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error("Form submissions list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
