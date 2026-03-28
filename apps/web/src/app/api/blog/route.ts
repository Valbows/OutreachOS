import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  author: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),
  ogImage: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const isPublic = request.nextUrl.searchParams.get("public") === "true";

    if (isPublic) {
      // Safe parsing of limit with bounds checking
      const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

      // Safe parsing of offset with bounds checking
      const rawOffset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);
      const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

      const posts = await BlogService.listPublished(limit, offset);
      return NextResponse.json({ data: posts });
    }

    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posts = await BlogService.list(account.id);
    return NextResponse.json({ data: posts });
  } catch (error) {
    console.error("Blog list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const post = await BlogService.create({
      accountId: account.id,
      ...parsed.data,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (error) {
    console.error("Blog create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
