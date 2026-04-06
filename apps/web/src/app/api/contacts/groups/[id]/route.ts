import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const group = await ContactService.getGroupById(account.id, id);
    
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (err) {
    console.error("Group get error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to get group",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, description } = body;

    // Validate types
    if (name !== undefined && typeof name !== "string") {
      return NextResponse.json({ error: "Group name must be a string" }, { status: 400 });
    }
    if (description !== undefined && typeof description !== "string") {
      return NextResponse.json({ error: "Group description must be a string" }, { status: 400 });
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Group name cannot be empty" }, { status: 400 });
    }

    // Check group exists and belongs to account
    const existing = await ContactService.getGroupById(account.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Update via service - using updateGroup which needs to be added to ContactService
    // For now, we'll implement inline
    const { db, contactGroups } = await import("@outreachos/db");
    const { eq, and } = await import("drizzle-orm");
    
    const [updated] = await db
      .update(contactGroups)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        updatedAt: new Date(),
      })
      .where(and(eq(contactGroups.id, id), eq(contactGroups.accountId, account.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Group update error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to update group",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Check group exists and belongs to account
    const existing = await ContactService.getGroupById(account.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    await ContactService.deleteGroup(account.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Group delete error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to delete group",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
