import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const preferencesSchema = z.object({
  llmProvider: z.enum(["gemini", "openrouter"]).optional(),
  llmModel: z.string().max(200).nullable().optional(),
  senderDomain: z.string().max(255).nullable().optional(),
  gmailAddress: z.string().email().nullable().optional(),
  gmailRefreshToken: z.string().nullable().optional(),
});

async function getAccountPreferences(accountId: string) {
  const [record] = await db
    .select({
      llmProvider: accounts.llmProvider,
      llmModel: accounts.llmModel,
      senderDomain: accounts.senderDomain,
      gmailAddress: accounts.gmailAddress,
      gmailRefreshToken: accounts.gmailRefreshToken,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  // Return boolean flag instead of sensitive token
  return {
    llmProvider: record?.llmProvider ?? "gemini",
    llmModel: record?.llmModel ?? "",
    senderDomain: record?.senderDomain ?? "",
    gmailAddress: record?.gmailAddress ?? "",
    gmailConnected: !!record?.gmailAddress && !!record?.gmailRefreshToken,
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
    const err = error as Error;
    console.error("Preferences get error:", err?.message, "\nStack:", err?.stack);
    return NextResponse.json({ error: "Internal server error", details: err?.message }, { status: 500 });
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

    // Get current preferences (safe for API response) and raw token for internal use
    const currentPreferences = await getAccountPreferences(account.id);
    
    // Query raw gmailRefreshToken separately for internal use
    const [rawRecord] = await db
      .select({ gmailRefreshToken: accounts.gmailRefreshToken })
      .from(accounts)
      .where(eq(accounts.id, account.id))
      .limit(1);
    const currentRefreshToken = rawRecord?.gmailRefreshToken ?? null;

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
      gmailAddress:
        "gmailAddress" in parsed.data
          ? parsed.data.gmailAddress === null
            ? null
            : (parsed.data.gmailAddress?.trim() || null)
          : (currentPreferences.gmailAddress || null),
      gmailRefreshToken:
        "gmailRefreshToken" in parsed.data
          ? parsed.data.gmailRefreshToken === null
            ? null
            : (parsed.data.gmailRefreshToken?.trim() || null)
          : currentRefreshToken,
    };

    await db
      .update(accounts)
      .set({
        llmProvider: nextValues.llmProvider,
        llmModel: nextValues.llmModel,
        senderDomain: nextValues.senderDomain,
        gmailAddress: nextValues.gmailAddress,
        gmailRefreshToken: nextValues.gmailRefreshToken,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    return NextResponse.json({
      data: {
        llmProvider: nextValues.llmProvider,
        llmModel: nextValues.llmModel ?? "",
        senderDomain: nextValues.senderDomain ?? "",
        gmailAddress: nextValues.gmailAddress ?? "",
        gmailConnected: !!nextValues.gmailAddress && !!nextValues.gmailRefreshToken,
      },
      message: "Preferences updated",
    });
  } catch (error) {
    console.error("Preferences update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
