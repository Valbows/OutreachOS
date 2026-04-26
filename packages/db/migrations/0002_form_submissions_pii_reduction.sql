--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "hashed_ip" text;
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "retention_expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
-- Migrate existing rows: HMAC-hash the raw ip_address with an external pepper, set 90-day retention.
--
-- PREREQUISITE: Before running this migration, the session must have `app.ip_pepper`
-- configured, e.g.:
--     SET app.ip_pepper = '<secret-from-secrets-manager>';
-- The pepper MUST be stored in your secrets manager (Vault, AWS Secrets Manager,
-- Doppler, etc.) and loaded into the DB session at migration time. A plain SHA-256
-- of an IPv4 address is trivially brute-forceable (the entire v4 space is ~4B);
-- using HMAC with a server-side pepper makes the hash non-reversible without the key.
UPDATE "form_submissions"
SET
  "hashed_ip" = encode(hmac("ip_address", current_setting('app.ip_pepper'), 'sha256'), 'hex'),
  "retention_expires_at" = "submitted_at" + INTERVAL '90 days'
WHERE "ip_address" IS NOT NULL;
--> statement-breakpoint
-- Null out and drop the raw ip_address column
ALTER TABLE "form_submissions" DROP COLUMN "ip_address";
