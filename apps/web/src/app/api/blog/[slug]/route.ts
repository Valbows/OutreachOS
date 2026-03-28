import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { BlogService } from "@outreachos/services";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),
  ogImage: z.string().url().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

/** Public: get post by slug */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const post = await BlogService.getBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ data: post });
  } catch (error) {
    console.error("Blog get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Admin: update post (slug param is used as post ID lookup for admin) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { slug } = await params;
    // slug param doubles as postId for admin updates
    const updated = await BlogService.update(account.id, slug, {
      ...parsed.data,
      publishedAt: parsed.data.publishedAt === null
        ? null
        : parsed.data.publishedAt
          ? new Date(parsed.data.publishedAt)
          : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Blog update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    await BlogService.delete(account.id, slug);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Blog delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
