/**
 * REST API v1 - Campaign Actions
 * POST /api/v1/campaigns/[id]/duplicate — duplicate a campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { CampaignService } from "@outreachos/services";
import { z } from "zod";

const duplicateSchema = z.object({
  name: z.string().min(1).optional(),
});

async function handlePost(
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
    body = {};
  }

  const parsed = duplicateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const original = await CampaignService.getById(ctx.accountId, id);
  if (!original) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const newName = parsed.data.name || `${original.name} (Copy)`;

  const duplicate = await CampaignService.create({
    accountId: ctx.accountId,
    name: newName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB returns string; CampaignService type is a narrower union
    type: original.type as any,
    groupId: original.groupId ?? undefined,
    templateId: original.templateId ?? undefined,
    settings: original.settings ?? undefined,
  });

  return NextResponse.json({
    data: duplicate,
    message: "Campaign duplicated successfully",
  });
}

const postHandler = withRateLimit(withApiAuth(handlePost, { requiredScopes: ["write", "admin"] }));

export async function POST(req: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return postHandler(req, { params: routeCtx.params });
}
