/**
 * API Key Authentication for REST API
 * Validates Bearer token and returns account context
 */

import { NextRequest, NextResponse } from "next/server";
import { db, apiKeys, apiUsage } from "@outreachos/db";
import { eq, and, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { checkRateLimit } from "./rate-limiter.js";

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

  const keyHash = createHash("sha256").update(token).digest("hex");

  const [key] = await db
    .select({
      id: apiKeys.id,
      accountId: apiKeys.accountId,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!key) {
    return null;
  }

  // Update last used timestamp (non-blocking, failures logged but not rethrown)
  try {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));
  } catch (err) {
    console.warn("Failed to update lastUsedAt", { keyId: key.id, err });
  }

  return {
    accountId: key.accountId,
    apiKeyId: key.id,
    scopes: (key.scopes as string[]) || [],
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
      const hasScope = options.requiredScopes.some((s) => apiContext!.scopes.includes(s));
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
 * Wraps handler with rate limiting
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

    const { allowed, remaining, resetAt } = await checkRateLimit(apiContext.apiKeyId);
    
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
