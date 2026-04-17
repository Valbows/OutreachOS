/**
 * API Key Authentication for REST API
 * Validates Bearer token and returns account context
 */

import { NextRequest, NextResponse } from "next/server";
import { db, apiKeys, apiUsage, accounts, PLAN_RATE_LIMITS, type PlanTier, type RateLimitConfig } from "@outreachos/db";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { checkRateLimit, DEFAULT_RATE_LIMIT } from "./rate-limiter.js";

export interface ApiContext {
  accountId: string;
  apiKeyId: string;
  scopes: string[];
}

export type ApiHandler = (
  req: NextRequest,
  context: ApiContext,
  params?: Record<string, string>
) => Promise<NextResponse>;

/**
 * Validates API key from Authorization header
 * Returns account context or null if invalid
 */
export async function validateApiKey(req: NextRequest): Promise<ApiContext | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token.startsWith("osk_")) {
    return null;
  }

  // Get all non-revoked keys for this account and check bcrypt hash
  // This is less efficient than direct lookup but required for bcrypt comparison
  const potentialKeys = await db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      scopes: apiKeys.scopes,
      keyHash: apiKeys.keyHash,
    })
    .from(apiKeys)
    .where(isNull(apiKeys.revokedAt));

  // Find matching key using bcrypt compare
  let matchedKey: typeof potentialKeys[0] | null = null;
  for (const key of potentialKeys) {
    const isMatch = await bcrypt.compare(token, key.keyHash);
    if (isMatch) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    return null;
  }

  // Update last used timestamp (non-blocking, failures logged but not rethrown)
  try {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, matchedKey.id));
  } catch (err) {
    console.warn("Failed to update lastUsedAt", { keyId: matchedKey.id, err });
  }

  return {
    accountId: matchedKey.accountId,
    apiKeyId: matchedKey.id,
    scopes: (matchedKey.scopes as string[]) || [],
  };
}

/**
 * Records API usage for analytics
 */
export async function recordApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  try {
    await db.insert(apiUsage).values({
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
    });
  } catch (err) {
    console.error("Failed to record API usage:", err);
  }
}

/**
 * Check if user scopes satisfy required scopes (OR logic - any matching scope grants access)
 * Exported for testing
 */
export function checkScopes(userScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.some((s) => userScopes.includes(s));
}

/**
 * Wraps an API handler with authentication and usage tracking
 */
export function withApiAuth(
  handler: ApiHandler,
  options?: { requiredScopes?: string[] }
): (req: NextRequest, ctx?: { params?: Promise<Record<string, string>>; apiContext?: ApiContext }) => Promise<NextResponse> {
  return async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>>; apiContext?: ApiContext }) => {
    const startTime = Date.now();
    const endpoint = req.nextUrl.pathname;
    const method = req.method;

    // Use pre-validated context if provided, otherwise validate
    let apiContext: ApiContext;
    if (ctx?.apiContext) {
      apiContext = ctx.apiContext;
    } else {
      const validated = await validateApiKey(req);
      if (!validated) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Invalid or missing API key" },
          { status: 401 }
        );
      }
      apiContext = validated;
    }

    // Check required scopes
    if (options?.requiredScopes) {
      const hasScope = checkScopes(apiContext.scopes, options.requiredScopes);
      if (!hasScope) {
        await recordApiUsage(apiContext.apiKeyId, endpoint, method, 403, Date.now() - startTime);
        return NextResponse.json(
          { error: "Forbidden", message: `Required scope: ${options.requiredScopes.join(" or ")}` },
          { status: 403 }
        );
      }
    }

    try {
      const params = ctx?.params ? await ctx.params : undefined;
      const response = await handler(req, apiContext, params);
      const status = response.status;
      await recordApiUsage(apiContext.apiKeyId, endpoint, method, status, Date.now() - startTime);
      return response;
    } catch (err) {
      console.error(`API error [${endpoint}]:`, err);
      await recordApiUsage(apiContext.apiKeyId, endpoint, method, 500, Date.now() - startTime);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Get rate limit configuration for an account
 * Combines plan defaults with any custom overrides
 */
async function getAccountRateLimit(accountId: string): Promise<RateLimitConfig> {
  try {
    const [account] = await db
      .select({
        plan: accounts.plan,
        rateLimit: accounts.rateLimit,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return DEFAULT_RATE_LIMIT;
    }

    // Get plan defaults
    const planLimits = PLAN_RATE_LIMITS[(account.plan as PlanTier) ?? "free"];

    // Apply custom overrides if any
    const customLimits = account.rateLimit ?? {};

    return {
      windowMs: customLimits.windowMs ?? planLimits.windowMs,
      maxRequests: customLimits.maxRequests ?? planLimits.maxRequests,
    };
  } catch (err) {
    console.warn("[RateLimit] Failed to get account rate limit:", err);
    return DEFAULT_RATE_LIMIT;
  }
}

/**
 * Wraps handler with rate limiting
 * Uses account-specific limits based on plan and custom settings
 */
export function withRateLimit(
  handler: (req: NextRequest, ctx?: { params?: Promise<Record<string, string>>; apiContext?: ApiContext }) => Promise<NextResponse>
): typeof handler {
  return async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>>; apiContext?: ApiContext }) => {
    // Reuse existing apiContext if provided (avoids double validation when composed with withApiAuth)
    let apiContext = ctx?.apiContext;
    if (!apiContext) {
      apiContext = (await validateApiKey(req)) ?? undefined;
    }
    if (!apiContext) {
      return handler(req, ctx);
    }

    // Get account-specific rate limits
    const rateLimitConfig = await getAccountRateLimit(apiContext.accountId);
    const { allowed, remaining, resetAt } = await checkRateLimit(apiContext.apiKeyId, rateLimitConfig);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = await handler(req, { ...ctx, apiContext });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    return response;
  };
}
