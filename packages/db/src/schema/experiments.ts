import { pgTable, uuid, text, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";
import { campaigns } from "./campaigns.js";

export const experiments = pgTable("experiments", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // subject_line, body_cta
  status: text("status").default("active").notNull(), // active, champion_found, production
  championVariant: text("champion_variant"),
  consecutiveWins: integer("consecutive_wins").default(0),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const experimentBatches = pgTable("experiment_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id").notNull().references(() => experiments.id, { onDelete: "cascade" }),
  batchNumber: integer("batch_number").notNull(),
  variantA: text("variant_a").notNull(),
  variantB: text("variant_b").notNull(),
  contactsPerVariant: integer("contacts_per_variant").default(20),
  variantAOpenRate: real("variant_a_open_rate"),
  variantBOpenRate: real("variant_b_open_rate"),
  variantAResponseRate: real("variant_a_response_rate"),
  variantBResponseRate: real("variant_b_response_rate"),
  winner: text("winner"), // variant_a, variant_b, tie
  decisionRationale: text("decision_rationale"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  account: one(accounts, { fields: [experiments.accountId], references: [accounts.id] }),
  campaign: one(campaigns, { fields: [experiments.campaignId], references: [campaigns.id] }),
  batches: many(experimentBatches),
}));

export const experimentBatchesRelations = relations(experimentBatches, ({ one }) => ({
  experiment: one(experiments, { fields: [experimentBatches.experimentId], references: [experiments.id] }),
}));
