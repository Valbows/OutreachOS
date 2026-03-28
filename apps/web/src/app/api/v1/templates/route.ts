/**
 * REST API v1 - Templates
 * GET /api/v1/templates — list templates
 * POST /api/v1/templates — create template
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { TemplateService } from "@outreachos/services";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
});

async function handleGet(_req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  const templates = await TemplateService.list(ctx.accountId);
  return NextResponse.json({ templates });
}

async function handlePost(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const template = await TemplateService.create({
    accountId: ctx.accountId,
    name: parsed.data.name,
    subject: parsed.data.subject,
    bodyHtml: parsed.data.bodyHtml,
    bodyText: parsed.data.bodyText,
  });
  return NextResponse.json({ template }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
