import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url("Must be a valid URL").optional(),
  apiKey: z.string().nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = await params;
    const updated = await McpService.update(account.id, id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Server not found" }, { status: 404 });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("MCP update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await McpService.delete(account.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("MCP delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
