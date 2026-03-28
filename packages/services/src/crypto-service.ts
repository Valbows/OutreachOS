/**
 * CryptoService — AES-256-GCM encryption for BYOK key management
 * Keys are encrypted at rest in Postgres; raw keys never logged.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export class CryptoService {
  /**
   * Derive an AES-256 key from a master password and salt using scrypt.
   * The master password should come from an environment variable (ENCRYPTION_KEY).
   */
  private static deriveKey(masterKey: string, salt: Buffer): Buffer {
    return scryptSync(masterKey, salt, KEY_LENGTH);
  }

  /**
   * Get the master encryption key from environment.
   * Throws if not configured.
   */
  private static getMasterKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 16) {
      throw new Error("ENCRYPTION_KEY environment variable must be set (min 16 chars)");
    }
    return key;
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns a base64 string containing: salt + iv + authTag + ciphertext
   */
  static encrypt(plaintext: string): string {
    const masterKey = CryptoService.getMasterKey();
    const salt = randomBytes(SALT_LENGTH);
    const key = CryptoService.deriveKey(masterKey, salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Pack: salt(16) + iv(16) + authTag(16) + ciphertext
    const packed = Buffer.concat([salt, iv, authTag, encrypted]);
    return packed.toString("base64");
  }

  /**
   * Decrypt a base64 encrypted string produced by encrypt().
   * Returns the original plaintext.
   */
  static decrypt(encryptedBase64: string): string {
    const masterKey = CryptoService.getMasterKey();
    const packed = Buffer.from(encryptedBase64, "base64");

    const salt = packed.subarray(0, SALT_LENGTH);
    const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = CryptoService.deriveKey(masterKey, salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  /**
   * Encrypt a BYOK key record (object of provider → key mappings).
   * Each key value is individually encrypted.
   */
  static encryptKeys(keys: Record<string, string>): Record<string, string> {
    const encrypted: Record<string, string> = {};
    for (const [provider, apiKey] of Object.entries(keys)) {
      if (apiKey && apiKey.trim()) {
        encrypted[provider] = CryptoService.encrypt(apiKey);
      }
    }
    return encrypted;
  }

  /**
   * Decrypt a BYOK key record.
   */
  static decryptKeys(encryptedKeys: Record<string, string>): Record<string, string> {
    const decrypted: Record<string, string> = {};
    for (const [provider, encValue] of Object.entries(encryptedKeys)) {
      if (encValue) {
        try {
          decrypted[provider] = CryptoService.decrypt(encValue);
        } catch {
          console.error(`Failed to decrypt BYOK key for provider: ${provider}`);
        }
      }
    }
    return decrypted;
  }
}
