/**
 * REST API v1 - LinkedIn Playbook
 * GET /api/v1/linkedin — list LinkedIn playbook entries
 * POST /api/v1/linkedin — generate LinkedIn copy
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { LinkedInService } from "@outreachos/services";
import { z } from "zod";

const generateCopySchema = z.object({
  contactId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  prompt: z.string().optional(),
}).refine((data) => data.contactId || data.groupId, {
  message: "Either contactId or groupId is required",
});

async function handleGet(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const rawOffset = req.nextUrl.searchParams.get("offset");
  const status = req.nextUrl.searchParams.get("status") || undefined;
  
  // Parse and validate limit (default 50, max 100)
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 50;
  const limit = Number.isFinite(parsedLimit) && !Number.isNaN(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 100))
    : 50;
  
  // Parse and validate offset (default 0, min 0)
  const parsedOffset = rawOffset ? parseInt(rawOffset, 10) : 0;
  const offset = Number.isFinite(parsedOffset) && !Number.isNaN(parsedOffset)
    ? Math.max(0, parsedOffset)
    : 0;
  
  const result = await LinkedInService.list({
    accountId: ctx.accountId,
    limit,
    offset,
    status,
  });
  return NextResponse.json({ playbooks: result.entries, total: result.total });
}

async function handlePost(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = generateCopySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const playbook = await LinkedInService.generateCopy({
    accountId: ctx.accountId,
    contactId: parsed.data.contactId,
    groupId: parsed.data.groupId,
    prompt: parsed.data.prompt || "Write a professional LinkedIn connection request",
  });
  return NextResponse.json({ playbook }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
