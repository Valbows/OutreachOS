/**
 * Distributed Rate Limiter with Redis
 * Falls back to in-memory store for local development
 */

import Redis from "ioredis";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 100;

// In-memory fallback for local tests
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Periodic sweeper to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW_MS);
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
 */
export async function checkRateLimit(
  apiKeyId: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClient();

  if (redis && redisAvailable) {
    return checkRateLimitRedis(redis, apiKeyId);
  }

  return checkRateLimitMemory(apiKeyId);
}

/**
 * Redis-based rate limiting with atomic INCR and EXPIRE
 */
async function checkRateLimitRedis(
  redis: Redis,
  apiKeyId: string
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
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS
    )) as [number, number];

    const [count, ttlRemaining] = result;
    const allowed = count < RATE_LIMIT_MAX_REQUESTS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count);
    const resetAt = now + ttlRemaining;

    return { allowed, remaining, resetAt };
  } catch (err: unknown) {
    // Fallback to memory on Redis error
    console.warn("[RateLimiter] Redis error, falling back to memory:", err);
    return checkRateLimitMemory(apiKeyId);
  }
}

/**
 * In-memory rate limiting (fallback for local tests)
 */
function checkRateLimitMemory(apiKeyId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(apiKeyId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

export { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS };
