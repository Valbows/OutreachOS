/**
 * REST API v1 - Accounts
 * GET /api/v1/accounts — return the account associated with the authenticated API key
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, withRateLimit, ApiContext } from "@/lib/api/auth";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

async function handleGet(req: NextRequest, ctx: ApiContext): Promise<NextResponse> {
  // Return the account associated with the API key
  const [account] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      email: accounts.email,
      llmProvider: accounts.llmProvider,
      llmModel: accounts.llmModel,
      senderDomain: accounts.senderDomain,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.id, ctx.accountId))
    .limit(1);

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ data: account });
}

const getHandler = withRateLimit(withApiAuth(handleGet, { requiredScopes: ["read", "admin"] }));

export async function GET(req: NextRequest) {
  return getHandler(req);
}
