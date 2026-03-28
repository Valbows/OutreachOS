import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CryptoService } from "./crypto-service.js";

describe("CryptoService", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-for-unit-tests-min16";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe("encrypt / decrypt round-trip", () => {
    it("encrypts and decrypts a simple string", () => {
      const plaintext = "sk-test-api-key-12345";
      const encrypted = CryptoService.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toBeTruthy();

      const decrypted = CryptoService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("encrypts and decrypts an empty string", () => {
      const encrypted = CryptoService.encrypt("");
      const decrypted = CryptoService.decrypt(encrypted);
      expect(decrypted).toBe("");
    });

    it("encrypts and decrypts unicode content", () => {
      const plaintext = "api-key-with-émojis-🔑-and-日本語";
      const encrypted = CryptoService.encrypt(plaintext);
      const decrypted = CryptoService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for same plaintext (random IV/salt)", () => {
      const plaintext = "same-key-value";
      const enc1 = CryptoService.encrypt(plaintext);
      const enc2 = CryptoService.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);

      // Both decrypt to the same value
      expect(CryptoService.decrypt(enc1)).toBe(plaintext);
      expect(CryptoService.decrypt(enc2)).toBe(plaintext);
    });

    it("fails decryption with wrong master key", () => {
      const encrypted = CryptoService.encrypt("secret-api-key");
      process.env.ENCRYPTION_KEY = "different-master-key-for-testing";
      expect(() => CryptoService.decrypt(encrypted)).toThrow();
    });

    it("fails decryption with tampered ciphertext", () => {
      const encrypted = CryptoService.encrypt("secret-api-key");
      const tampered = encrypted.slice(0, -4) + "XXXX";
      expect(() => CryptoService.decrypt(tampered)).toThrow();
    });
  });

  describe("encryptKeys / decryptKeys", () => {
    it("encrypts and decrypts a key record", () => {
      const keys = {
        gemini: "AIzaSyB-test-key-123",
        openrouter: "sk-or-v1-test-key-456",
        hunter: "hunter-api-key-789",
      };

      const encrypted = CryptoService.encryptKeys(keys);
      expect(Object.keys(encrypted)).toEqual(["gemini", "openrouter", "hunter"]);
      expect(encrypted.gemini).not.toBe(keys.gemini);

      const { keys: decrypted, errors } = CryptoService.decryptKeys(encrypted);
      expect(errors).toEqual([]);
      expect(decrypted).toEqual(keys);
    });

    it("skips empty/whitespace-only values", () => {
      const keys = { gemini: "real-key", openrouter: "", hunter: "   " };
      const encrypted = CryptoService.encryptKeys(keys);
      expect(Object.keys(encrypted)).toEqual(["gemini"]);
    });
  });

  describe("error handling", () => {
    it("throws if ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => CryptoService.encrypt("test")).toThrow("ENCRYPTION_KEY");
    });

    it("throws if ENCRYPTION_KEY is too short", () => {
      process.env.ENCRYPTION_KEY = "short";
      expect(() => CryptoService.encrypt("test")).toThrow("ENCRYPTION_KEY");
    });
  });
});
