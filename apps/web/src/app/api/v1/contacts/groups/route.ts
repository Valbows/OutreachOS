/**
 * REST API v1 - Contact Groups
 * GET /api/v1/contacts/groups — list groups
 * POST /api/v1/contacts/groups — create group
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { ContactService } from "@outreachos/services";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

async function handleGet(_req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  const groups = await ContactService.listGroups(ctx.accountId);
  return NextResponse.json({ groups });
}

async function handlePost(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const group = await ContactService.createGroup(
    ctx.accountId,
    parsed.data.name,
    parsed.data.description
  );
  return NextResponse.json({ group }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
