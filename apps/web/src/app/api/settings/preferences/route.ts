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

async function getAccountPreferences(accountId: string) {
  const [record] = await db
    .select({
      llmProvider: accounts.llmProvider,
      llmModel: accounts.llmModel,
      senderDomain: accounts.senderDomain,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return {
    llmProvider: record?.llmProvider ?? "gemini",
    llmModel: record?.llmModel ?? "",
    senderDomain: record?.senderDomain ?? "",
  };
}

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getAccountPreferences(account.id);

    return NextResponse.json({
      data: preferences,
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

    const currentPreferences = await getAccountPreferences(account.id);

    const nextValues = {
      llmProvider: parsed.data.llmProvider ?? currentPreferences.llmProvider,
      llmModel:
        "llmModel" in parsed.data
          ? parsed.data.llmModel === null
            ? null
            : (parsed.data.llmModel?.trim() || null)
          : (currentPreferences.llmModel || null),
      senderDomain:
        "senderDomain" in parsed.data
          ? parsed.data.senderDomain === null
            ? null
            : (parsed.data.senderDomain?.trim() || null)
          : (currentPreferences.senderDomain || null),
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

    return NextResponse.json({
      data: {
        llmProvider: nextValues.llmProvider,
        llmModel: nextValues.llmModel ?? "",
        senderDomain: nextValues.senderDomain ?? "",
      },
      message: "Preferences updated",
    });
  } catch (error) {
    console.error("Preferences update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
