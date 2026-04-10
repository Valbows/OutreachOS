import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { FunnelService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  groupId: z.string().uuid(),
  conditions: z.array(
    z.object({
      conditionType: z.enum(["did_not_open", "opened_more_than", "replied", "filled_form"]),
      referenceCampaignId: z.string().uuid().optional(),
      referenceFormId: z.string().uuid().optional(),
      threshold: z.number().int().min(1).optional(),
    })
  ),
  steps: z.array(
    z.object({
      name: z.string().min(1).max(100),
      templateId: z.string().uuid(),
      delayDays: z.number().int().min(0),
      delayHour: z.number().int().min(0).max(23).optional(),
    })
  ).min(1).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const funnel = await FunnelService.create({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json({ data: funnel }, { status: 201 });
  } catch (error) {
    console.error("Funnel create error:", error);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const funnels = await FunnelService.list(account.id);
    return NextResponse.json({ data: funnels });
  } catch (error) {
    console.error("Funnel list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
