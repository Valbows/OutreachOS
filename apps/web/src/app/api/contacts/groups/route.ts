import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await ContactService.listGroups(account.id);
    return NextResponse.json(groups);
  } catch (err) {
    console.error("Groups list error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to list groups",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const group = await ContactService.createGroup(account.id, name.trim(), description?.trim());
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error("Group create error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to create group",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
