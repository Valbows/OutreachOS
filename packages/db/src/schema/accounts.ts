import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export type PlanTier = "free" | "starter" | "growth" | "enterprise";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const PLAN_RATE_LIMITS: Record<PlanTier, RateLimitConfig> = {
  free: { windowMs: 60_000, maxRequests: 30 },
  starter: { windowMs: 60_000, maxRequests: 100 },
  growth: { windowMs: 60_000, maxRequests: 500 },
  enterprise: { windowMs: 60_000, maxRequests: 2000 },
};

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Stable Neon Auth user ID - used for account lookup regardless of email changes
  neonAuthId: text("neon_auth_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  senderDomain: text("sender_domain"),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port"),
  imapUser: text("imap_user"),
  /** AES-256-GCM ciphertext (CryptoService) — never store plaintext */
  imapPasswordEncrypted: text("imap_password_encrypted"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  /** AES-256-GCM ciphertext (CryptoService) — never store plaintext */
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  // Gmail OAuth
  gmailAddress: text("gmail_address"),
  /** AES-256-GCM ciphertext (CryptoService) — never store plaintext */
  gmailRefreshTokenEncrypted: text("gmail_refresh_token_encrypted"),
  llmProvider: text("llm_provider").default("gemini"),
  llmModel: text("llm_model"),
  byokKeys: jsonb("byok_keys").$type<Record<string, string>>(),
  // Plan tier for billing and rate limiting
  plan: text("plan").$type<PlanTier>().default("free").notNull(),
  // Custom rate limit override (optional)
  rateLimit: jsonb("rate_limit").$type<Partial<RateLimitConfig>>(),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
