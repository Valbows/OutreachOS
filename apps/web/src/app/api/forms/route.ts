import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";
import { z } from "zod";

const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "email", "phone", "dropdown", "checkbox", "textarea", "hidden"]),
  required: z.boolean(),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["minimal", "modal", "inline_banner", "multi_step", "side_drawer"]),
  fields: z.array(fieldSchema).min(1).max(50),
  // HTML/CSS content with size limits to prevent huge payloads (DoS mitigation only)
  // NOTE: These limits do NOT prevent XSS — sanitize on output or here before storing
  // TODO: Add server-side sanitization (DOMPurify/sanitize-html) before storing
  htmlContent: z.string().max(50000).optional(), // ~50KB limit
  cssContent: z.string().max(20000).optional(),   // ~20KB limit
  successMessage: z.string().max(500).optional(),
  redirectUrl: z.string().url().optional(),
  journeyId: z.string().uuid().optional(),
  funnelId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forms = await FormService.list(account.id);
    return NextResponse.json({ data: forms });
  } catch (error) {
    console.error("Form list error:", error);
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

    const form = await FormService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: form }, { status: 201 });
  } catch (error) {
    console.error("Form create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
