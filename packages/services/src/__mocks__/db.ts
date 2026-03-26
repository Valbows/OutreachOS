/**
 * Mock for @outreachos/db — prevents DATABASE_URL requirement in unit tests.
 * Only the schema exports and a no-op db are needed for pure-method tests.
 */
import { vi } from "vitest";

export const db = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  innerJoin: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
};

// Re-export all schema symbols as empty mocks
export const contacts = {};
export const contactGroups = {};
export const contactGroupMembers = {};
export const accounts = {};
