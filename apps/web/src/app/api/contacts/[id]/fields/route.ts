/**
 * Agent-Writable Custom Contact Fields API
 * GET /api/contacts/[id]/fields — get all custom fields
 * PUT /api/contacts/[id]/fields — set a custom field (push)
 * DELETE /api/contacts/[id]/fields — remove a custom field
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";
import { z } from "zod";

const pushFieldSchema = z.object({
  fieldName: z.string().min(1).max(64),
  fieldValue: z.unknown(),
});

const deleteFieldSchema = z.object({
  fieldName: z.string().min(1).max(64),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const contact = await ContactService.getById(account.id, id);
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    return NextResponse.json({ customFields: contact.customFields ?? {} });
  } catch (err) {
    console.error("Get custom fields error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = pushFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const contact = await ContactService.getById(account.id, id);
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const customFields = (contact.customFields ?? {}) as Record<string, unknown>;
    customFields[parsed.data.fieldName] = parsed.data.fieldValue;

    const updated = await ContactService.update(account.id, id, { customFields } as any);
    return NextResponse.json({ customFields: updated?.customFields ?? customFields });
  } catch (err) {
    console.error("Push custom field error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = deleteFieldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const contact = await ContactService.getById(account.id, id);
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const customFields = (contact.customFields ?? {}) as Record<string, unknown>;
    delete customFields[parsed.data.fieldName];

    await ContactService.update(account.id, id, { customFields } as any);
    return NextResponse.json({ customFields });
  } catch (err) {
    console.error("Delete custom field error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
