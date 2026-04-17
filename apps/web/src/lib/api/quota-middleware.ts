/**
 * API Quota Middleware
 * Enforces usage quotas on API endpoints with circuit breaker and fallback rate limiting
 */

import { NextRequest, NextResponse } from "next/server";
import { BillingService, type UsageType } from "@outreachos/services";
import type { ApiContext } from "./auth.js";

export interface QuotaConfig {
  /** Usage type to check against */
  type: UsageType;
  /** Amount to reserve (default: 1) */
  amount?: number;
  /** Whether to allow the request if quota check fails (default: false) */
  allowIfQuotaExceeded?: boolean;
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const CIRCUIT_BREAKER_THRESHOLD = 5; // Trip after 5 consecutive failures
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 second cooldown
const FALLBACK_RATE_LIMIT = 100; // Requests per window
const FALLBACK_WINDOW_MS = 60000; // 1 minute window

// Max entries to prevent unbounded memory growth
const MAX_CIRCUIT_BREAKER_ENTRIES = 10000;
const MAX_FALLBACK_RATE_ENTRIES = 10000;
const MAX_FAIL_OPEN_ENTRIES = 10000;

// In-memory state (per-instance, not distributed) with bounded growth
const circuitBreakerState: Map<string, CircuitBreakerState> = new Map();
const fallbackRateLimitMap: Map<string, { count: number; resetAt: number }> = new Map();
const failOpenCounter: Map<string, { count: number; lastUpdated: number }> = new Map();

/**
 * Evict oldest entries from circuit breaker state when stale
 */
function cleanupCircuitBreakerState(): void {
  const now = Date.now();
  for (const [key, state] of circuitBreakerState.entries()) {
    // Remove entries that are closed and haven't failed in a while
    if (!state.isOpen && now - state.lastFailureTime > CIRCUIT_BREAKER_COOLDOWN_MS) {
      circuitBreakerState.delete(key);
    }
  }

  // LRU eviction if still over limit
  if (circuitBreakerState.size > MAX_CIRCUIT_BREAKER_ENTRIES) {
    const entries = Array.from(circuitBreakerState.entries());
    entries.sort((a, b) => a[1].lastFailureTime - b[1].lastFailureTime);
    const toDelete = entries.slice(0, entries.length - MAX_CIRCUIT_BREAKER_ENTRIES);
    for (const [key] of toDelete) {
      circuitBreakerState.delete(key);
    }
  }
}

/**
 * Evict expired rate limit windows
 */
function cleanupFallbackRateLimitMap(): void {
  const now = Date.now();
  for (const [key, entry] of fallbackRateLimitMap.entries()) {
    if (entry.resetAt < now) {
      fallbackRateLimitMap.delete(key);
    }
  }

  // LRU eviction if still over limit
  if (fallbackRateLimitMap.size > MAX_FALLBACK_RATE_ENTRIES) {
    const entries = Array.from(fallbackRateLimitMap.entries());
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDelete = entries.slice(0, entries.length - MAX_FALLBACK_RATE_ENTRIES);
    for (const [key] of toDelete) {
      fallbackRateLimitMap.delete(key);
    }
  }
}

/**
 * Evict stale fail-open counters
 */
function cleanupFailOpenCounter(): void {
  const now = Date.now();
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  for (const [key, entry] of failOpenCounter.entries()) {
    if (now - entry.lastUpdated > STALE_THRESHOLD_MS) {
      failOpenCounter.delete(key);
    }
  }

  // LRU eviction if still over limit
  if (failOpenCounter.size > MAX_FAIL_OPEN_ENTRIES) {
    const entries = Array.from(failOpenCounter.entries());
    entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    const toDelete = entries.slice(0, entries.length - MAX_FAIL_OPEN_ENTRIES);
    for (const [key] of toDelete) {
      failOpenCounter.delete(key);
    }
  }
}

/**
 * Get or initialize circuit breaker state for an account
 */
function getCircuitBreakerState(accountId: string): CircuitBreakerState {
  // Clean up stale entries periodically
  cleanupCircuitBreakerState();

  let state = circuitBreakerState.get(accountId);
  if (!state) {
    state = { failures: 0, lastFailureTime: 0, isOpen: false };
    circuitBreakerState.set(accountId, state);
  }
  return state;
}

/**
 * Check if circuit breaker is open (tripped)
 */
function isCircuitOpen(state: CircuitBreakerState): boolean {
  if (!state.isOpen) return false;
  
  // Check if cooldown has elapsed
  const now = Date.now();
  if (now - state.lastFailureTime > CIRCUIT_BREAKER_COOLDOWN_MS) {
    // Reset circuit to half-open
    state.isOpen = false;
    state.failures = 0;
    return false;
  }
  return true;
}

/**
 * Record success - reset circuit breaker
 */
function recordSuccess(state: CircuitBreakerState): void {
  state.failures = 0;
  state.isOpen = false;
}

/**
 * Record failure - increment counter and potentially trip circuit
 */
function recordFailure(state: CircuitBreakerState): void {
  state.failures++;
  state.lastFailureTime = Date.now();
  
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
  }
}

/**
 * Increment fail-open counter for monitoring
 */
function incrementFailOpenCounter(accountId: string, type: string): void {
  const key = `${accountId}:${type}`;
  const now = Date.now();
  const entry = failOpenCounter.get(key);
  const newCount = entry ? entry.count + 1 : 1;
  failOpenCounter.set(key, { count: newCount, lastUpdated: now });

  // Log periodically (every 10 failures) to avoid spam
  if (newCount % 10 === 0) {
    console.warn(`[QuotaMiddleware] quota_fail_open counter: ${newCount} for ${key}`);
  }
}

/**
 * Check fallback rate limit (token bucket per account)
 */
function checkFallbackRateLimit(accountId: string): { allowed: boolean; remaining: number } {
  // Clean up stale entries periodically
  cleanupFallbackRateLimitMap();

  const now = Date.now();
  let entry = fallbackRateLimitMap.get(accountId);

  if (!entry || entry.resetAt < now) {
    // New window
    entry = { count: 1, resetAt: now + FALLBACK_WINDOW_MS };
    fallbackRateLimitMap.set(accountId, entry);
    return { allowed: true, remaining: FALLBACK_RATE_LIMIT - 1 };
  }
  
  if (entry.count >= FALLBACK_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: FALLBACK_RATE_LIMIT - entry.count };
}

/**
 * Wraps an API handler with quota enforcement
 * Checks if account has available quota before allowing the request
 */
export function withQuotaCheck(
  handler: (req: NextRequest, ctx: ApiContext, params?: Record<string, string>) => Promise<NextResponse>,
  config: QuotaConfig
) {
  return async (
    req: NextRequest,
    ctx: ApiContext,
    params?: Record<string, string>
  ): Promise<NextResponse> => {
    const { type, amount = 1, allowIfQuotaExceeded = false } = config;
    const cbState = getCircuitBreakerState(ctx.accountId);
    
    // Check if circuit breaker is open
    if (isCircuitOpen(cbState)) {
      console.warn(`[QuotaMiddleware] Circuit breaker OPEN for account ${ctx.accountId}, using fallback rate limit`);
      const fallbackResult = checkFallbackRateLimit(ctx.accountId);
      
      if (!fallbackResult.allowed) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: "Service temporarily unavailable. Please try again later.",
            type,
            circuitState: "open",
          },
          { status: 429 }
        );
      }
      
      // Fallback rate limit permits - continue with caution
      return handler(req, ctx, params);
    }

    try {
      // Attempt atomic check-and-increment
      const allowed = await BillingService.reserveOrIncrement(ctx.accountId, type, amount);
      
      // Record success - reset circuit breaker
      recordSuccess(cbState);

      if (!allowed) {
        if (allowIfQuotaExceeded) {
          // Allow request but log warning
          console.warn(
            `[QuotaMiddleware] Quota exceeded for account ${ctx.accountId} (${type}: ${amount}), allowing request (allowIfQuotaExceeded=true)`
          );
        } else {
          // Return quota exceeded error
          return NextResponse.json(
            {
              error: "Quota exceeded",
              message: `Monthly quota exceeded for ${type}. Please upgrade your plan or wait until the next billing cycle.`,
              type,
            },
            { status: 429 }
          );
        }
      }

      // Continue to handler
      return handler(req, ctx, params);
    } catch (err) {
      // Record failure - may trip circuit breaker
      recordFailure(cbState);
      incrementFailOpenCounter(ctx.accountId, type);
      
      console.error(`[QuotaMiddleware] Error checking quota (circuit: ${cbState.isOpen ? 'OPEN' : 'CLOSED'}, failures: ${cbState.failures}):`, err);
      
      // Apply fallback rate limiting instead of fail-open
      const fallbackResult = checkFallbackRateLimit(ctx.accountId);
      
      if (!fallbackResult.allowed) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: "Service temporarily unavailable due to quota system issues. Please try again later.",
            type,
            circuitState: cbState.isOpen ? "open" : "closed",
          },
          { status: 429 }
        );
      }
      
      // Fallback permits - continue with reduced rate
      console.warn(`[QuotaMiddleware] Fallback rate limit permitted for account ${ctx.accountId} (${fallbackResult.remaining} remaining)`);
      return handler(req, ctx, params);
    }
  };
}

/**
 * Higher-order function to compose withApiAuth with quota check
 * Usage: withApiAuth(withQuotaCheck(handler, { type: "apiCalls" }))
 */
export function composeWithQuota(
  handler: (req: NextRequest, ctx: ApiContext, params?: Record<string, string>) => Promise<NextResponse>,
  quotaConfig: QuotaConfig
) {
  return withQuotaCheck(handler, quotaConfig);
}

/**
 * Get fail-open metrics for monitoring
 */
export function getFailOpenMetrics(): Record<string, number> {
  cleanupFailOpenCounter();
  const result: Record<string, number> = {};
  for (const [key, entry] of failOpenCounter.entries()) {
    result[key] = entry.count;
  }
  return result;
}

/**
 * Reset fail-open counter (for testing or periodic cleanup)
 */
export function resetFailOpenCounter(): void {
  failOpenCounter.clear();
}
