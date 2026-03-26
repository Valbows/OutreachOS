import { vi } from "vitest";
import { NextRequest } from "next/server";
import type { Account } from "@/lib/auth/session";

/**
 * Create a mock NextRequest for API route testing.
 * If `init.body` is provided as a string, `request.json()` will resolve to the parsed JSON.
 */
export function createMockRequest(url: string, init?: RequestInit): NextRequest {
  const urlObj = new URL(url);
  return {
    url: urlObj.toString(),
    nextUrl: urlObj,
    headers: new Headers(init?.headers),
    method: init?.method ?? "GET",
    json: vi.fn().mockResolvedValue(
      init?.body ? JSON.parse(init.body as string) : {},
    ),
    text: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    arrayBuffer: vi.fn(),
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    cache: "default",
    credentials: "same-origin",
    destination: "",
    integrity: "",
    keepalive: false,
    mode: "cors",
    redirect: "follow",
    referrer: "",
    referrerPolicy: "",
    signal: new AbortController().signal,
  } as unknown as NextRequest;
}

/**
 * Create a mock Account object with sensible defaults.
 * Pass `overrides` to customise individual fields.
 */
export function createMockAccount(overrides?: Partial<Account>): Account {
  return {
    id: "acc-123",
    email: "test@example.com",
    name: "Test User",
    senderDomain: null,
    imapHost: null,
    imapPort: null,
    imapUser: null,
    imapPassword: null,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpPassword: null,
    openaiApiKey: null,
    llmPreference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Account;
}
