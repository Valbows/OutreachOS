/**
 * REST API v1 - Single Contact Operations
 * GET /api/v1/contacts/[id] — get contact details
 * PATCH /api/v1/contacts/[id] — update contact
 * DELETE /api/v1/contacts/[id] — delete contact
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { ContactService } from "@outreachos/services";
import { z } from "zod";

const updateContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().nullable(),
  companyName: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

async function handleGet(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Contact ID required" }, { status: 400 });
  }

  const contact = await ContactService.getById(ctx.accountId, id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ contact });
}

async function handlePatch(
  req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Contact ID required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const contact = await ContactService.update(ctx.accountId, id, parsed.data);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ contact });
}

async function handleDelete(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Contact ID required" }, { status: 400 });
  }

  const contact = await ContactService.getById(ctx.accountId, id);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await ContactService.delete(ctx.accountId, [id]);
  return NextResponse.json({ success: true });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const patchHandler = withRateLimit(withApiAuth(handlePatch, { requiredScopes: ["write", "admin"] }));
const deleteHandler = withRateLimit(withApiAuth(handleDelete, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return getHandler(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return patchHandler(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return deleteHandler(req, ctx);
}
