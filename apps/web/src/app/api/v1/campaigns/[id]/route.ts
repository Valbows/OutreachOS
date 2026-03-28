/**
 * REST API v1 - Single Campaign Operations
 * GET /api/v1/campaigns/[id] — get campaign details
 * PATCH /api/v1/campaigns/[id] — update campaign
 * DELETE /api/v1/campaigns/[id] — delete campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "stopped"]).optional(),
});

async function handleGet(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
  }

  const campaign = await CampaignService.getById(ctx.accountId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

async function handlePatch(
  req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const campaign = await CampaignService.update(ctx.accountId, id, parsed.data);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

async function handleDelete(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
  }

  // Atomic delete - returns true if deleted, false if not found
  const deleted = await CampaignService.delete(ctx.accountId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

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
