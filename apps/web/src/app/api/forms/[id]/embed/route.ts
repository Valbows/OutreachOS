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

    const baseUrl = request.nextUrl.origin;
    const hosted = FormService.generateEmbedCode(id, baseUrl, "hosted");
    const iframe = FormService.generateEmbedCode(id, baseUrl, "iframe");
    const widget = FormService.generateEmbedCode(id, baseUrl, "widget");

    return NextResponse.json({
      data: { hosted, iframe, widget },
    });
  } catch (error) {
    console.error("Form embed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
