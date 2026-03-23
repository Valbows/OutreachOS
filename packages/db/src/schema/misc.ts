import { pgTable, uuid, text, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";

export const linkedinPlaybooks = pgTable("linkedin_playbooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id"),
  groupId: uuid("group_id"),
  prompt: text("prompt"),
  generatedCopy: text("generated_copy"),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const llmUsageLog = pgTable("llm_usage_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  purpose: text("purpose").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  cost: real("cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiUsage = pgTable("api_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>(),
  author: text("author"),
  metaDescription: text("meta_description"),
  ogImage: text("og_image"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const linkedinPlaybooksRelations = relations(linkedinPlaybooks, ({ one }) => ({
  account: one(accounts, { fields: [linkedinPlaybooks.accountId], references: [accounts.id] }),
}));

export const llmUsageLogRelations = relations(llmUsageLog, ({ one }) => ({
  account: one(accounts, { fields: [llmUsageLog.accountId], references: [accounts.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  account: one(accounts, { fields: [apiKeys.accountId], references: [accounts.id] }),
  usage: many(apiUsage),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  apiKey: one(apiKeys, { fields: [apiUsage.apiKeyId], references: [apiKeys.id] }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  account: one(accounts, { fields: [blogPosts.accountId], references: [accounts.id] }),
}));
