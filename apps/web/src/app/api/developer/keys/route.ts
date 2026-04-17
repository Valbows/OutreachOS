/**
 * Developer API Keys Management
 * GET /api/developer/keys — list all API keys for the account
 * POST /api/developer/keys — create a new API key
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { db, apiKeys } from "@outreachos/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(["read", "write", "admin"])).min(1),
});

// bcrypt cost factor - higher is more secure but slower (10-12 recommended)
const BCRYPT_SALT_ROUNDS = 10;

async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const key = `osk_${randomBytes(32).toString("hex")}`;
  const hash = await bcrypt.hash(key, BCRYPT_SALT_ROUNDS);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export async function GET() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.label,
        prefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.accountId, account.id), isNull(apiKeys.revokedAt)))
      .orderBy(apiKeys.createdAt);

    return NextResponse.json({ keys });
  } catch (err) {
    console.error("API keys list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { key, hash, prefix } = await generateApiKey();

    const [created] = await db
      .insert(apiKeys)
      .values({
        accountId: account.id,
        label: parsed.data.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: parsed.data.scopes,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.label,
        prefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      });

    return NextResponse.json({ key, apiKey: created }, { status: 201 });
  } catch (err) {
    console.error("API key create error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
