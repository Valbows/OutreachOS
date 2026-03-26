import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = request.nextUrl.searchParams.get("group_id") ?? undefined;
    const idsParam = request.nextUrl.searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",") : undefined;
    const csv = await ContactService.exportCSV(account.id, groupId, ids);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-export-${Date.now()}.csv"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    console.error("Contact export error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to export contacts",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
