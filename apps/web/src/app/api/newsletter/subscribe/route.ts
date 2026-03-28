import { NextRequest, NextResponse } from "next/server";
import { BlogService } from "@outreachos/services";
import { z } from "zod";

const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(100).optional(),
  accountId: z.string().uuid(),
});

/** Public newsletter subscription endpoint */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await BlogService.subscribeToNewsletter(
      parsed.data.accountId,
      parsed.data.email,
      parsed.data.firstName,
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    // Log only sanitized error info — avoid logging request body or sensitive data
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Newsletter subscribe failed:", errorMessage.slice(0, 100));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
