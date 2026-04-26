import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";
import { contacts } from "./contacts.js";
import { campaigns } from "./campaigns.js";

export const formTemplates = pgTable("form_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // minimal, modal, inline_banner, multi_step, side_drawer
  fields: jsonb("fields").$type<Array<{ name: string; type: string; required: boolean; label: string }>>(),
  steps: jsonb("steps").$type<Array<{ id: string; stepNumber: number; title: string; fields: string[] }>>(),
  htmlContent: text("html_content"),
  cssContent: text("css_content"),
  successMessage: text("success_message"),
  redirectUrl: text("redirect_url"),
  journeyId: uuid("journey_id").references(() => campaigns.id, { onDelete: "set null" }),
  funnelId: uuid("funnel_id").references(() => campaigns.id, { onDelete: "set null" }),
  submissionCount: integer("submission_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  /** HMAC-SHA-256 hex of the raw IP address (keyed on IP_HASH_PEPPER / app.ip_pepper) — never stores the raw IP */
  hashedIp: text("hashed_ip"),
  /** Truncated to 256 chars to limit PII surface */
  userAgent: text("user_agent"),
  /** PII purge deadline; a background job should null hashedIp/userAgent after this date */
  retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const formTemplatesRelations = relations(formTemplates, ({ one, many }) => ({
  account: one(accounts, { fields: [formTemplates.accountId], references: [accounts.id] }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(formTemplates, { fields: [formSubmissions.formId], references: [formTemplates.id] }),
}));
