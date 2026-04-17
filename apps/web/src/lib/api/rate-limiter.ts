/**
 * Distributed Rate Limiter with Redis
 * Falls back to in-memory store for local development
 * Supports configurable rate limits per account/plan
 */

import Redis from "ioredis";
import type { RateLimitConfig } from "@outreachos/db";

// Default rate limit (fallback)
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 100,
};

// In-memory fallback for local tests
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic sweeper to prevent memory leak (runs every minute)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }, 60_000);
}

// Lazy Redis client initialization
let redisClient: Redis | null = null;
let redisAvailable = false;
let redisErrorLogged = false;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!redisErrorLogged) {
      console.warn("[RateLimiter] REDIS_URL not set, using in-memory store (local mode)");
      redisErrorLogged = true;
    }
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      console.log("[RateLimiter] Redis connected successfully");
      redisAvailable = true;
    });

    redisClient.on("error", (err: Error) => {
      if (!redisErrorLogged) {
        console.error("[RateLimiter] Redis connection error:", err.message);
        redisErrorLogged = true;
      }
      redisAvailable = false;
    });

    // Connect eagerly to detect failures
    redisClient.connect().catch((err: Error) => {
      if (!redisErrorLogged) {
        console.error("[RateLimiter] Redis connection failed:", err.message);
        redisErrorLogged = true;
      }
      redisAvailable = false;
    });

    return redisClient;
  } catch (err: unknown) {
    if (!redisErrorLogged) {
      console.error("[RateLimiter] Failed to create Redis client:", err);
      redisErrorLogged = true;
    }
    return null;
  }
}

/**
 * Check rate limit for an API key
 * Uses Redis in production, falls back to in-memory for local tests
 * Supports configurable limits per account/plan
 */
export async function checkRateLimit(
  apiKeyId: string,
  config?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limits = config ?? DEFAULT_RATE_LIMIT;
  const redis = getRedisClient();

  if (redis && redisAvailable) {
    return checkRateLimitRedis(redis, apiKeyId, limits);
  }

  return checkRateLimitMemory(apiKeyId, limits);
}

/**
 * Redis-based rate limiting with atomic INCR and EXPIRE
 */
async function checkRateLimitRedis(
  redis: Redis,
  apiKeyId: string,
  limits: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `rate_limit:${apiKeyId}`;
  const now = Date.now();

  // Use Redis INCR and EXPIRE atomically via Lua script
  // Returns {count, ttlRemainingMs} where ttlRemainingMs is the actual PTTL for existing keys
  const luaScript = `
    local current = redis.call("GET", KEYS[1])
    if not current then
      redis.call("SET", KEYS[1], 1, "PX", ARGV[1])
      return {1, ARGV[1]}
    end
    local count = tonumber(current)
    local ttl = redis.call("PTTL", KEYS[1])
    if count >= tonumber(ARGV[2]) then
      return {count, ttl}
    end
    redis.call("INCR", KEYS[1])
    return {count + 1, ttl}
  `;

  try {
    const result = (await redis.eval(
      luaScript,
      1,
      key,
      limits.windowMs,
      limits.maxRequests
    )) as [number, number];

    const [count, ttlRemaining] = result;
    const allowed = count <= limits.maxRequests;
    const remaining = Math.max(0, limits.maxRequests - count);
    const resetAt = now + ttlRemaining;

    return { allowed, remaining, resetAt };
  } catch (err: unknown) {
    // Fallback to memory on Redis error
    console.warn("[RateLimiter] Redis error, falling back to memory:", err);
    return checkRateLimitMemory(apiKeyId, limits);
  }
}

/**
 * In-memory rate limiting (fallback for local tests)
 */
function checkRateLimitMemory(
  apiKeyId: string,
  limits: RateLimitConfig
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(apiKeyId, {
      count: 1,
      resetAt: now + limits.windowMs,
    });
    return {
      allowed: true,
      remaining: limits.maxRequests - 1,
      resetAt: now + limits.windowMs,
    };
  }

  if (entry.count >= limits.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limits.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export { DEFAULT_RATE_LIMIT };
export type { RateLimitConfig };
