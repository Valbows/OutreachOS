/**
 * LinkedIn Playbook API — CRUD + generation
 * GET /api/linkedin — list playbook entries
 * POST /api/linkedin — generate new LinkedIn copy
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { LinkedInService } from "@outreachos/services";
import { z } from "zod";

const generateSchema = z.object({
  contactId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(2000),
  researchNotes: z.string().max(5000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offsetRaw = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = Number.isNaN(limitRaw) || limitRaw < 1 ? 50 : Math.min(limitRaw, 100);
    const offset = Number.isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;
    const status = url.searchParams.get("status") ?? undefined;

    const result = await LinkedInService.list({
      accountId: account.id,
      limit,
      offset,
      status,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("LinkedIn list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await LinkedInService.generateCopy({
      accountId: account.id,
      ...parsed.data,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("LLM_KEY_MISSING")) {
      return NextResponse.json({ error: "LLM API key not configured" }, { status: 422 });
    }
    console.error("LinkedIn generate error:", message.slice(0, 200));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
