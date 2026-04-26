--> statement-breakpoint
-- Add email_hash column (SHA-256 hex, non-reversible) to replace plaintext email.
ALTER TABLE "hunter_usage_log" ADD COLUMN "email_hash" text;

--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
-- Backfill: hash existing plaintext emails using pgcrypto.
-- encode(digest(lower(trim(email)), 'sha256'), 'hex') matches the application-layer hash.
UPDATE "hunter_usage_log"
SET "email_hash" = encode(digest(lower(trim("email")), 'sha256'), 'hex')
WHERE "email" IS NOT NULL;

--> statement-breakpoint
-- Remove the plaintext PII column.
ALTER TABLE "hunter_usage_log" DROP COLUMN "email";
