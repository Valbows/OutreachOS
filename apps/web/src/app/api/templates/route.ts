import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { TemplateService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  tokenFallbacks: z.record(z.string(), z.string()).optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await TemplateService.list(account.id);
    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("Template list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
      }
      throw err;
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const template = await TemplateService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("Template create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
