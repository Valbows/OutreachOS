import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ContactService } from "@outreachos/services";

export async function GET(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const groupId = searchParams.get("group_id") ?? undefined;

    // Validate sortBy against allowed values
    const allowedSortBy = ["name", "company", "email", "score", "createdAt"] as const;
    const sortByParam = searchParams.get("sort_by");
    const sortBy = allowedSortBy.includes(sortByParam as typeof allowedSortBy[number])
      ? (sortByParam as typeof allowedSortBy[number])
      : "createdAt";

    // Validate sortDir against allowed values
    const sortDirParam = searchParams.get("sort_dir");
    const sortDir = sortDirParam === "asc" || sortDirParam === "desc" ? sortDirParam : "desc";

    // Parse and validate limit (1..200, default 50)
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 50;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

    // Parse and validate offset (non-negative integer, default 0)
    const offsetParam = searchParams.get("offset");
    const parsedOffset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const result = await ContactService.list({
      accountId: account.id,
      search,
      groupId,
      sortBy,
      sortDir,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Contacts list error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to list contacts",
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy untyped JSON parse; TODO migrate to Zod
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { firstName, lastName, email, businessWebsite, companyName, city, state, linkedinUrl, customFields } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }

    // Validate customFields is a plain object if provided
    let validatedCustomFields: Record<string, unknown> | null = null;
    if (customFields !== undefined && customFields !== null) {
      if (typeof customFields !== "object" || Array.isArray(customFields)) {
        return NextResponse.json({ error: "customFields must be a plain object" }, { status: 400 });
      }
      // Enforce max 20 keys and max depth of 2
      const keys = Object.keys(customFields);
      if (keys.length > 20) {
        return NextResponse.json({ error: "customFields exceeds maximum of 20 keys" }, { status: 400 });
      }
      // Check max depth (2 levels)
      for (const key of keys) {
        const value = customFields[key];
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const nestedKeys = Object.keys(value);
          if (nestedKeys.length > 20) {
            return NextResponse.json({ error: `customFields.${key} exceeds maximum of 20 keys` }, { status: 400 });
          }
        }
      }
      validatedCustomFields = customFields as Record<string, unknown>;
    }

    const contact = await ContactService.create({
      accountId: account.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      businessWebsite: businessWebsite?.trim() || null,
      companyName: companyName?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      linkedinUrl: linkedinUrl?.trim() || null,
      customFields: validatedCustomFields,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    console.error("Contact create error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to create contact",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy untyped JSON parse; TODO migrate to Zod
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { ids } = body;

    // Validate ids is an array of non-empty strings
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    // Enforce max batch size
    const MAX_BATCH_SIZE = 100;
    if (ids.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 413 }
      );
    }

    // Validate and sanitize each id
    const validatedIds = ids
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());

    if (validatedIds.length === 0) {
      return NextResponse.json({ error: "ids array must contain valid non-empty strings" }, { status: 400 });
    }

    const deletedCount = await ContactService.delete(account.id, validatedIds);
    return NextResponse.json({ deleted: deletedCount });
  } catch (err) {
    console.error("Contact delete error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : "Failed to delete contacts",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
