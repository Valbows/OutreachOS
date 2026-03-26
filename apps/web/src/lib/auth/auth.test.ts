import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createNeonAuthMock = vi.fn(() => ({
  handler: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  middleware: vi.fn(),
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  getSession: vi.fn(),
}));

const createAuthClientMock = vi.fn(() => ({
  signIn: { social: vi.fn(), email: vi.fn() },
  signOut: vi.fn(),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: createNeonAuthMock,
}));

vi.mock("@neondatabase/auth/next", () => ({
  createAuthClient: createAuthClientMock,
}));

describe("lib/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEON_AUTH_BASE_URL = "https://ep-test.neonauth.us-east-1.aws.neon.tech/testdb/auth";
    process.env.NEON_AUTH_COOKIE_SECRET = "test-secret-that-is-at-least-32-characters-long";
  });

  afterEach(() => {
    delete process.env.NEON_AUTH_BASE_URL;
    delete process.env.NEON_AUTH_COOKIE_SECRET;
  });

  describe("server", () => {
    it("creates a NeonAuth instance with baseUrl and cookie secret from env", async () => {
      const mod = await import("./server");
      // Trigger lazy initialization
      mod.getAuth();

      expect(createNeonAuthMock).toHaveBeenCalledWith({
        baseUrl: "https://ep-test.neonauth.us-east-1.aws.neon.tech/testdb/auth",
        cookies: {
          secret: "test-secret-that-is-at-least-32-characters-long",
        },
      });
    });

    it("exports the auth instance", async () => {
      const mod = await import("./server");
      expect(mod.auth).toBeDefined();
      expect(mod.auth.handler).toBeDefined();
      expect(mod.auth.middleware).toBeDefined();
    });

    it("throws if NEON_AUTH_BASE_URL is missing", async () => {
      delete process.env.NEON_AUTH_BASE_URL;
      const mod = await import("./server");
      expect(() => mod.getAuth()).toThrow(
        "NEON_AUTH_BASE_URL environment variable is required but not set."
      );
    });

    it("throws if NEON_AUTH_COOKIE_SECRET is missing", async () => {
      delete process.env.NEON_AUTH_COOKIE_SECRET;
      const mod = await import("./server");
      expect(() => mod.getAuth()).toThrow(
        "NEON_AUTH_COOKIE_SECRET environment variable is required but not set."
      );
    });
  });

  describe("client", () => {
    it("creates an auth client for browser-side operations", async () => {
      const mod = await import("./client");
      expect(createAuthClientMock).toHaveBeenCalled();
      expect(mod.authClient).toBeDefined();
      expect(mod.authClient.signIn).toBeDefined();
      expect(mod.authClient.signOut).toBeDefined();
    });
  });

  describe("index barrel", () => {
    it("re-exports auth from server", async () => {
      const mod = await import("./index");
      expect(mod.auth).toBeDefined();
    });
  });
});
