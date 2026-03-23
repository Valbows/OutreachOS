import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";

export const formTemplates = pgTable("form_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // minimal, modal, inline_banner, multi_step, side_drawer
  fields: jsonb("fields").$type<Array<{ name: string; type: string; required: boolean; label: string }>>(),
  htmlContent: text("html_content"),
  cssContent: text("css_content"),
  successMessage: text("success_message"),
  redirectUrl: text("redirect_url"),
  journeyId: uuid("journey_id"),
  funnelId: uuid("funnel_id"),
  submissionCount: integer("submission_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id").notNull().references(() => formTemplates.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const formTemplatesRelations = relations(formTemplates, ({ one, many }) => ({
  account: one(accounts, { fields: [formTemplates.accountId], references: [accounts.id] }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(formTemplates, { fields: [formSubmissions.formId], references: [formTemplates.id] }),
}));
