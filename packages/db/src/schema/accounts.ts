import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  senderDomain: text("sender_domain"),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port"),
  imapUser: text("imap_user"),
  imapPassword: text("imap_password"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  llmProvider: text("llm_provider").default("gemini"),
  llmModel: text("llm_model"),
  byokKeys: jsonb("byok_keys").$type<Record<string, string>>(),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
