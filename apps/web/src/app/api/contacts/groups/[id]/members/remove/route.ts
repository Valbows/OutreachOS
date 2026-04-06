import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Verify group exists and belongs to account
    const group = await ContactService.getGroupById(account.id, groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    let body: { contactIds?: string[] };
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required" },
        { status: 400 }
      );
    }

    // Validate all contactIds are strings and clean them (trim and filter empty)
    const cleanedContactIds = contactIds
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);

    if (cleanedContactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds must contain valid string IDs" },
        { status: 400 }
      );
    }

    if (cleanedContactIds.length !== contactIds.length) {
      return NextResponse.json(
        { error: "contactIds must be an array of strings" },
        { status: 400 }
      );
    }

    // Validate all contactIds belong to this account
    const { db, contacts } = await import("@outreachos/db");
    const contactRecords = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.accountId, account.id),
          inArray(contacts.id, cleanedContactIds)
        )
      );

    const validContactIds = contactRecords.map((c) => c.id);
    const invalidIds = cleanedContactIds.filter((id) => !validContactIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some contacts not found", invalidIds },
        { status: 400 }
      );
    }

    await ContactService.removeFromGroup(groupId, validContactIds);

    return NextResponse.json({
      success: true,
      removed: validContactIds.length
    });
  } catch (err) {
    console.error("Remove from group error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to remove contacts from group",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
