--> statement-breakpoint
-- Rename plaintext secret columns to mark them as ciphertext-only.
-- Existing plaintext values are non-decryptable by CryptoService and must be cleared;
-- users must re-enter IMAP/SMTP passwords and re-link Gmail after this migration.
ALTER TABLE "accounts" RENAME COLUMN "imap_password" TO "imap_password_encrypted";
--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "smtp_password" TO "smtp_password_encrypted";
--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "gmail_refresh_token" TO "gmail_refresh_token_encrypted";
--> statement-breakpoint
-- Wipe pre-existing plaintext secrets so the application never tries to decrypt them.
UPDATE "accounts"
SET
  "imap_password_encrypted" = NULL,
  "smtp_password_encrypted" = NULL,
  "gmail_refresh_token_encrypted" = NULL;
