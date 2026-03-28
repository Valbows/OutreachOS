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

const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"] as const;

const pushFieldSchema = z.object({
  fieldName: z.string()
    .min(1)
    .max(64)
    .refine(
      (val) => !DANGEROUS_KEYS.includes(val as typeof DANGEROUS_KEYS[number]),
      { message: "fieldName contains a reserved key that is not allowed" }
    ),
  fieldValue: z.unknown(),
});

const deleteFieldSchema = z.object({
  fieldName: z.string()
    .min(1)
    .max(64)
    .refine(
      (val) => !DANGEROUS_KEYS.includes(val as typeof DANGEROUS_KEYS[number]),
      { message: "fieldName contains a reserved key that is not allowed" }
    ),
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

    // Atomic DB-level JSON merge — no TOCTOU race
    const updated = await ContactService.mergeCustomField(account.id, id, parsed.data.fieldName, parsed.data.fieldValue);
    if (!updated) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    return NextResponse.json({ customFields: updated.customFields });
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

    // Atomic DB-level field deletion — no TOCTOU race
    const updated = await ContactService.deleteCustomField(account.id, id, parsed.data.fieldName);
    if (!updated) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    return NextResponse.json({ customFields: updated.customFields });
  } catch (err) {
    console.error("Delete custom field error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
