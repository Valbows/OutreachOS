/**
 * REST API v1 - Experiments
 * GET /api/v1/experiments — list A/B test experiments
 * POST /api/v1/experiments — create a new experiment
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { ExperimentService } from "@outreachos/services";
import { z } from "zod";

const createExperimentSchema = z.object({
  name: z.string().min(1),
  campaignId: z.string().uuid(),
  type: z.enum(["subject_line", "body_cta"]),
  settings: z.record(z.string(), z.unknown()).optional(),
});

async function handleGet(
  _req: NextRequest,
  ctx: ApiContext
): Promise<NextResponse> {
  const experiments = await ExperimentService.list(ctx.accountId);
  return NextResponse.json({ data: experiments });
}

async function handlePost(
  req: NextRequest,
  ctx: ApiContext
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createExperimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const experiment = await ExperimentService.create({
    accountId: ctx.accountId,
    name: parsed.data.name,
    campaignId: parsed.data.campaignId,
    type: parsed.data.type,
    settings: parsed.data.settings,
  });

  return NextResponse.json({ data: experiment }, { status: 201 });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));
const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}

export async function POST(req: NextRequest) {
  return postHandler(req);
}
