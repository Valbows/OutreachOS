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
export const formTemplates = { id: {}, accountId: {}, journeyId: {}, funnelId: {}, submissionCount: {} };
export const formSubmissions = { id: {}, formId: {}, contactId: {} };
export const campaigns = { id: {}, accountId: {}, type: {}, status: {} };
export const campaignSteps = { id: {}, campaignId: {} };
export const journeyEnrollments = { id: {}, campaignId: {}, contactId: {} };
export const funnelConditions = { id: {}, campaignId: {} };
export const messageInstances = { id: {}, campaignId: {}, contactId: {} };
export const replies = { id: {}, contactId: {}, campaignId: {}, imapMessageId: {} };
export const emailEvents = { id: {}, campaignId: {}, contactId: {} };
export const blogPosts = { id: {}, accountId: {}, slug: {}, title: {}, publishedAt: {} };
export const templates = { id: {}, accountId: {}, templateType: {} };

// Re-export drizzle-orm functions
export const eq = vi.fn(() => ({}));
export const and = vi.fn(() => ({}));
export const or = vi.fn(() => ({}));
export const desc = vi.fn(() => ({}));
export const asc = vi.fn(() => ({}));
export const count = vi.fn(() => ({}));
export const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({}));
export const inArray = vi.fn(() => ({}));
export const isNull = vi.fn(() => ({}));
export const isNotNull = vi.fn(() => ({}));
export const lte = vi.fn(() => ({}));
