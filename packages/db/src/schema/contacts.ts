import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts.js";

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  businessWebsite: text("business_website"),
  companyName: text("company_name"),
  city: text("city"),
  state: text("state"),
  linkedinUrl: text("linkedin_url"),
  hunterScore: integer("hunter_score"),
  hunterStatus: text("hunter_status"),
  hunterSources: jsonb("hunter_sources").$type<string[]>(),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  unsubscribed: boolean("unsubscribed").default(false).notNull(),
  replied: boolean("replied").default(false).notNull(),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactGroups = pgTable("contact_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactGroupMembers = pgTable(
  "contact_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull().references(() => contactGroups.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.contactId, table.groupId),
  ]
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  account: one(accounts, { fields: [contacts.accountId], references: [accounts.id] }),
  groupMemberships: many(contactGroupMembers),
}));

export const contactGroupsRelations = relations(contactGroups, ({ one, many }) => ({
  account: one(accounts, { fields: [contactGroups.accountId], references: [accounts.id] }),
  members: many(contactGroupMembers),
}));

export const contactGroupMembersRelations = relations(contactGroupMembers, ({ one }) => ({
  contact: one(contacts, { fields: [contactGroupMembers.contactId], references: [contacts.id] }),
  group: one(contactGroups, { fields: [contactGroupMembers.groupId], references: [contactGroups.id] }),
}));
