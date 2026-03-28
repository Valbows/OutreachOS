import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { FormService } from "@outreachos/services";
import { z } from "zod";

// Allowed domains for form redirect URLs (prevents open redirects)
const ALLOWED_REDIRECT_DOMAINS = [
  "localhost",
  "localhost:3000",
  "outreachos.com",
  "www.outreachos.com",
];

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["minimal", "modal", "inline_banner", "multi_step", "side_drawer"]).optional(),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["text", "email", "phone", "dropdown", "checkbox", "textarea", "hidden"]),
        required: z.boolean(),
        label: z.string().min(1),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
        defaultValue: z.string().optional(),
      }),
    )
    .optional(),
  // HTML/CSS content with size limits to prevent XSS injection and huge payloads
  // NOTE: Values should be sanitized/escaped before rendering in UI
  htmlContent: z.string().max(50000).optional(), // ~50KB limit
  cssContent: z.string().max(20000).optional(),   // ~20KB limit
  successMessage: z.string().max(500).optional(),
  redirectUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val) return true; // null/undefined is allowed
        try {
          const hostname = new URL(val).hostname;
          // Allow relative URLs (hostname will be empty) or allowed domains
          return hostname === "" || ALLOWED_REDIRECT_DOMAINS.includes(hostname);
        } catch {
          return false;
        }
      },
      { message: "Redirect URL domain not permitted" },
    ),
  journeyId: z.string().uuid().nullable().optional(),
  funnelId: z.string().uuid().nullable().optional(),
});

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
    const form = await FormService.getById(account.id, id);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    return NextResponse.json({ data: form });
  } catch (error) {
    console.error("Form get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = await params;
    const updated = await FormService.update(account.id, id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Form update error:", error);
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
    await FormService.delete(account.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Form delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
