import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  tokens: jsonb("tokens").$type<string[]>(),
  tokenFallbacks: jsonb("token_fallbacks").$type<Record<string, string>>(),
  version: integer("version").default(1).notNull(),
  parentTemplateId: uuid("parent_template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // one_time, journey, funnel, ab_test, newsletter
  status: text("status").default("draft").notNull(), // draft, active, paused, completed, stopped
  groupId: uuid("group_id"),
  templateId: uuid("template_id").references(() => templates.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignSteps = pgTable("campaign_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name").notNull(), // Initial, 1st Follow Up, 2nd Follow Up, Hail Mary
  templateId: uuid("template_id").references(() => templates.id),
  delayDays: integer("delay_days").default(0),
  delayHour: integer("delay_hour"), // hour of day to send (0-23)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messageInstances = pgTable("message_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull(),
  stepId: uuid("step_id"),
  templateId: uuid("template_id"),
  experimentBatchId: uuid("experiment_batch_id"),
  resendMessageId: text("resend_message_id"),
  subject: text("subject"),
  status: text("status").default("pending").notNull(), // pending, sent, delivered, opened, clicked, bounced, complained, failed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  openCount: integer("open_count").default(0),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailEvents = pgTable("email_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageInstanceId: uuid("message_instance_id").notNull().references(() => messageInstances.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // delivered, opened, clicked, soft_bounce, hard_bounce, complained, unsubscribed
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const replies = pgTable("replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageInstanceId: uuid("message_instance_id").references(() => messageInstances.id),
  contactId: uuid("contact_id").notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  subject: text("subject"),
  bodyPreview: text("body_preview"),
  imapMessageId: text("imap_message_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  account: one(accounts, { fields: [campaigns.accountId], references: [accounts.id] }),
  template: one(templates, { fields: [campaigns.templateId], references: [templates.id] }),
  steps: many(campaignSteps),
  messages: many(messageInstances),
}));

export const campaignStepsRelations = relations(campaignSteps, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignSteps.campaignId], references: [campaigns.id] }),
  template: one(templates, { fields: [campaignSteps.templateId], references: [templates.id] }),
}));

export const messageInstancesRelations = relations(messageInstances, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [messageInstances.campaignId], references: [campaigns.id] }),
  events: many(emailEvents),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  messageInstance: one(messageInstances, { fields: [emailEvents.messageInstanceId], references: [messageInstances.id] }),
}));
