import { afterEach, describe, expect, it, vi } from "vitest";

async function importRateLimiterWithRedis(mockRedisClass: new (...args: any[]) => any) {
  vi.resetModules();
  vi.doMock("ioredis", () => ({ default: mockRedisClass }));
  return import("./rate-limiter");
}

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  delete process.env.REDIS_URL;
});

describe("checkRateLimit", () => {
  it("uses the in-memory fallback when REDIS_URL is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { checkRateLimit } = await importRateLimiterWithRedis(class {} as any);

    const first = await checkRateLimit("key_1");
    const second = await checkRateLimit("key_1");

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(99);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(98);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("blocks requests after the in-memory limit is exceeded and resets after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const { checkRateLimit, DEFAULT_RATE_LIMIT } = await importRateLimiterWithRedis(class {} as any);

    let result = await checkRateLimit("key_limit");
    for (let i = 0; i < 99; i += 1) {
      result = await checkRateLimit("key_limit");
    }
    const blocked = await checkRateLimit("key_limit");

    expect(result.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    vi.setSystemTime(new Date(Date.now() + DEFAULT_RATE_LIMIT.windowMs + 1));
    const reset = await checkRateLimit("key_limit");

    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(99);
  });

  it("uses redis when available", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const handlers: Record<string, () => void> = {};

    class MockRedis {
      on(event: string, cb: () => void) {
        handlers[event] = cb;
      }
      connect() {
        handlers.connect?.();
        return Promise.resolve();
      }
      eval() {
        return Promise.resolve([1, 60000]);
      }
    }

    const { checkRateLimit } = await importRateLimiterWithRedis(MockRedis as any);
    const result = await checkRateLimit("redis_key");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("falls back to memory when redis eval fails", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const handlers: Record<string, () => void> = {};
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    class MockRedis {
      on(event: string, cb: () => void) {
        handlers[event] = cb;
      }
      connect() {
        handlers.connect?.();
        return Promise.resolve();
      }
      eval() {
        return Promise.reject(new Error("eval failed"));
      }
    }

    const { checkRateLimit } = await importRateLimiterWithRedis(MockRedis as any);
    const result = await checkRateLimit("fallback_key");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
