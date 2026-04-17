/**
 * REST API v1 - Experiment Detail
 * GET /api/v1/experiments/[id] — get experiment details with log
 * DELETE /api/v1/experiments/[id] — delete an experiment
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { ExperimentService } from "@outreachos/services";

async function handleGet(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Experiment ID required" }, { status: 400 });
  }

  const summary = await ExperimentService.getSummary(ctx.accountId, id);
  if (!summary) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  const batches = await ExperimentService.getBatches(id);

  return NextResponse.json({
    data: {
      summary,
      batches,
    },
  });
}

async function handleDelete(
  _req: NextRequest,
  ctx: ApiContext,
  params?: Record<string, string>
): Promise<NextResponse> {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Experiment ID required" }, { status: 400 });
  }

  // Verify experiment exists before deleting
  const existing = await ExperimentService.getById(ctx.accountId, id);
  if (!existing) {
    return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
  }

  await ExperimentService.delete(ctx.accountId, id);
  return NextResponse.json({ success: true });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const deleteHandler = withRateLimit(withApiAuth(handleDelete, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return getHandler(req, { params: routeCtx.params });
}

export async function DELETE(req: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return deleteHandler(req, { params: routeCtx.params });
}
