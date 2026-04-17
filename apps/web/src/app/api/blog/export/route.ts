import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";

/**
 * Bulk export all blog posts for the authenticated account as JSON.
 * Returns a JSON array with full post records, suitable for backup/migration.
 */
export async function GET(_request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await BlogService.list(account.id);
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), posts }, null, 2);

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="blog-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Blog bulk export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
