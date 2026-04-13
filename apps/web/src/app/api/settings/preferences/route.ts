import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const preferencesSchema = z.object({
  llmProvider: z.enum(["gemini", "openrouter"]).optional(),
  llmModel: z.string().max(200).nullable().optional(),
  senderDomain: z.string().max(255).nullable().optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        llmProvider: account.llmProvider ?? "gemini",
        llmModel: account.llmModel ?? "",
        senderDomain: account.senderDomain ?? "",
      },
    });
  } catch (error) {
    console.error("Preferences get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const nextValues = {
      llmProvider: parsed.data.llmProvider ?? account.llmProvider ?? "gemini",
      llmModel:
        "llmModel" in parsed.data
          ? parsed.data.llmModel === null
            ? null
            : (parsed.data.llmModel?.trim() || null)
          : account.llmModel,
      senderDomain:
        "senderDomain" in parsed.data
          ? parsed.data.senderDomain === null
            ? null
            : (parsed.data.senderDomain?.trim() || null)
          : account.senderDomain,
    };

    await db
      .update(accounts)
      .set({
        llmProvider: nextValues.llmProvider,
        llmModel: nextValues.llmModel,
        senderDomain: nextValues.senderDomain,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    return NextResponse.json({ data: nextValues, message: "Preferences updated" });
  } catch (error) {
    console.error("Preferences update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
