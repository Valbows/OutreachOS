import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column, value) => ({ type: "eq", column, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  desc: vi.fn((column) => ({ type: "desc", column })),
  isNotNull: vi.fn((column) => ({ type: "isNotNull", column })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  })),
  count: vi.fn(() => ({ type: "count" })),
}));

vi.mock("@outreachos/db", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  blogPosts: {
    id: "blogPosts.id",
    accountId: "blogPosts.accountId",
    slug: "blogPosts.slug",
    publishedAt: "blogPosts.publishedAt",
    createdAt: "blogPosts.createdAt",
  },
  contacts: {},
  contactGroups: {},
  contactGroupMembers: {},
}));

import { db } from "@outreachos/db";
import { BlogService } from "./blog-service.js";

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
};

const mockDb = db as unknown as MockDb;

describe("BlogService public blog resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
  });

  it("returns an empty slug list when DATABASE_URL is missing", async () => {
    mockDb.where.mockRejectedValueOnce(
      new Error("DATABASE_URL environment variable is required but not set."),
    );

    await expect(BlogService.getAllSlugs()).resolves.toEqual([]);
  });

  it("returns an empty published post list when DATABASE_URL is missing", async () => {
    mockDb.where.mockReturnValueOnce(mockDb);
    mockDb.orderBy.mockReturnValueOnce(mockDb);
    mockDb.limit.mockReturnValueOnce(mockDb);
    mockDb.offset.mockRejectedValueOnce(
      new Error("DATABASE_URL environment variable is required but not set."),
    );

    await expect(BlogService.listPublished()).resolves.toEqual([]);
  });

  it("preserves the missing-table fallback for public blog reads", async () => {
    const missingTableError = new Error("wrapped drizzle error");
    Object.assign(missingTableError, {
      cause: { code: "42P01" },
    });

    mockDb.where.mockRejectedValueOnce(missingTableError);

    await expect(BlogService.getAllSlugs()).resolves.toEqual([]);
  });

  it("rethrows unexpected public blog errors", async () => {
    const unexpectedError = new Error("connection reset");
    mockDb.where.mockRejectedValueOnce(unexpectedError);

    await expect(BlogService.getAllSlugs()).rejects.toThrow("connection reset");
  });
});
