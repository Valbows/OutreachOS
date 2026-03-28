/**
 * REST API v1 - Contacts
 * GET /api/v1/contacts — list contacts
 * POST /api/v1/contacts — create contact
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { ContactService } from "@outreachos/services";
import { z } from "zod";

const createContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  companyName: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

async function handleGet(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const rawOffset = req.nextUrl.searchParams.get("offset");
  
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
  
  const search = req.nextUrl.searchParams.get("search") || undefined;

  const result = await ContactService.list({
    accountId: ctx.accountId,
    limit,
    offset,
    search,
  });
  return NextResponse.json(result);
}

async function handlePost(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const contact = await ContactService.create({
    accountId: ctx.accountId,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    companyName: parsed.data.companyName,
    linkedinUrl: parsed.data.linkedinUrl,
    customFields: parsed.data.customFields,
  });
  return NextResponse.json({ contact }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
