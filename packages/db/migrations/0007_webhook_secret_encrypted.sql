-- Rename webhooks.secret to webhooks.secret_encrypted to mark it as ciphertext-only.
-- Existing plaintext values are not decryptable by CryptoService and must be cleared;
-- active webhook endpoints will need to be re-created after this migration.

ALTER TABLE "webhooks" RENAME COLUMN "secret" TO "secret_encrypted";
--> statement-breakpoint

-- Wipe pre-existing plaintext secrets so the application never tries to use them.
UPDATE "webhooks" SET "secret_encrypted" = '';
