import { pgTable, uuid, text, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";

/** Outcome type for LinkedIn response classification */
export type ResponseOutcome = "positive" | "negative" | "neutral";

export const linkedinPlaybooks = pgTable("linkedin_playbooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id"),
  groupId: uuid("group_id"),
  prompt: text("prompt"),
  generatedCopy: text("generated_copy"),
  status: text("status").default("draft").notNull(),
  /** Stored response data for ML optimization (response text, outcome, etc.) */
  responseData: jsonb("response_data").$type<{
    lastResponse?: string;
    lastOutcome?: ResponseOutcome;
    responses?: Array<{ text: string; outcome: ResponseOutcome; receivedAt: string }>;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
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

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  enabled: integer("enabled").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attempts: integer("attempts").default(0).notNull(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  account: one(accounts, { fields: [webhooks.accountId], references: [accounts.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, { fields: [webhookDeliveries.webhookId], references: [webhooks.id] }),
}));

export const billingPlans = pgTable("billing_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  monthlyPrice: integer("monthly_price").default(0).notNull(),
  limits: jsonb("limits").$type<{
    contacts: number;
    emailsPerMonth: number;
    llmTokensPerMonth: number;
    hunterCreditsPerMonth: number;
    apiCallsPerMonth: number;
    webhooks: number;
  }>().notNull(),
  features: jsonb("features").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accountBilling = pgTable("account_billing", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  planId: uuid("plan_id").references(() => billingPlans.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  usageThisMonth: jsonb("usage_this_month").$type<{
    emails: number;
    llmTokens: number;
    hunterCredits: number;
    apiCalls: number;
  }>().default({ emails: 0, llmTokens: 0, hunterCredits: 0, apiCalls: 0 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const billingPlansRelations = relations(billingPlans, ({ many }) => ({
  accounts: many(accountBilling),
}));

export const accountBillingRelations = relations(accountBilling, ({ one }) => ({
  account: one(accounts, { fields: [accountBilling.accountId], references: [accounts.id] }),
  plan: one(billingPlans, { fields: [accountBilling.planId], references: [billingPlans.id] }),
}));
