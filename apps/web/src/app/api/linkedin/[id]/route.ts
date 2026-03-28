/**
 * LinkedIn Playbook [id] API
 * GET /api/linkedin/[id] — get single entry
 * PATCH /api/linkedin/[id] — update status or regenerate
 * DELETE /api/linkedin/[id] — delete entry
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { LinkedInService } from "@outreachos/services";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
  regenerate: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const entry = await LinkedInService.getById(account.id, id);
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(entry);
  } catch (err) {
    console.error("LinkedIn get error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.regenerate) {
      const result = await LinkedInService.regenerateCopy(account.id, id);
      return NextResponse.json(result);
    }

    if (parsed.data.status) {
      const result = await LinkedInService.updateStatus(account.id, id, parsed.data.status);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "No update action specified" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("PLAYBOOK_NOT_FOUND")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("LinkedIn update error:", message.slice(0, 200));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await LinkedInService.delete(account.id, id);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("LinkedIn delete error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
