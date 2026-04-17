import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { McpService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url("Must be a valid URL"),
  apiKey: z.string().optional(),
  description: z.string().max(300).optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const servers = await McpService.list(account.id);
    return NextResponse.json({ data: servers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("MCP list error:", errorMessage, errorStack);
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const server = await McpService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: server }, { status: 201 });
  } catch (error) {
    console.error("MCP create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
