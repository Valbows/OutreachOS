/**
 * BYOK Key Management API
 * GET /api/settings/byok — list configured providers (no raw keys returned)
 * PUT /api/settings/byok — update BYOK keys (encrypted at rest)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { CryptoService } from "@outreachos/services";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const byokSchema = z.object({
  gemini: z.string().optional(),
  openrouter: z.string().optional(),
  hunter: z.string().optional(),
  resend: z.string().optional(),
});

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Return only which providers have keys configured, never the raw keys
    const configured: Record<string, boolean> = {};
    if (account.byokKeys) {
      for (const provider of Object.keys(account.byokKeys)) {
        configured[provider] = true;
      }
    }

    return NextResponse.json({ providers: configured });
  } catch (err) {
    console.error("BYOK list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = byokSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    // Build new encrypted keys, preserving existing ones not being updated
    const existingKeys = account.byokKeys ?? {};
    const newKeys: Record<string, string> = { ...existingKeys };

    // Encrypt each provided key individually
    for (const [provider, rawKey] of Object.entries(parsed.data)) {
      if (rawKey && rawKey.trim()) {
        newKeys[provider] = CryptoService.encrypt(rawKey);
      }
    }

    await db
      .update(accounts)
      .set({ byokKeys: newKeys, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    // Return which providers are now configured
    const configured: Record<string, boolean> = {};
    for (const provider of Object.keys(newKeys)) {
      configured[provider] = true;
    }

    return NextResponse.json({ providers: configured, message: "BYOK keys updated" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENCRYPTION_KEY")) {
      return NextResponse.json({ error: "Server encryption key not configured" }, { status: 500 });
    }
    console.error("BYOK update error:", message.slice(0, 200));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
