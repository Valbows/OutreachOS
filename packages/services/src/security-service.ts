/**
 * Security Service - Audit, compliance, and security utilities
 */

import { db, contacts, apiKeys } from "@outreachos/db";
import { eq, and, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";

export interface SecurityAuditResult {
  passed: boolean;
  checks: {
    name: string;
    status: "pass" | "warn" | "fail";
    message: string;
  }[];
}

export class SecurityService {
  /**
   * Run security audit for an account
   */
  static async runAudit(accountId: string): Promise<SecurityAuditResult> {
    const checks: SecurityAuditResult["checks"] = [];

    // Check for stale API keys (not rotated in 90+ days)
    const staleKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.accountId, accountId),
          isNull(apiKeys.revokedAt),
          lt(apiKeys.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        )
      );

    checks.push({
      name: "API Key Rotation",
      status: staleKeys.length === 0 ? "pass" : "warn",
      message:
        staleKeys.length === 0
          ? "All API keys rotated within 90 days"
          : `${staleKeys.length} API key(s) not rotated in 90+ days`,
    });

    // Check for contacts without unsubscribe capability (CAN-SPAM)
    const contactsWithEmail = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(and(eq(contacts.accountId, accountId), isNotNull(contacts.email)));

    const unsubscribedContacts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(and(eq(contacts.accountId, accountId), eq(contacts.unsubscribed, true)));

    const emailCount = contactsWithEmail[0]?.count ?? 0;
    const unsubscribedCount = unsubscribedContacts[0]?.count ?? 0;
    const unsubscribeRate = emailCount > 0 ? (unsubscribedCount / emailCount) * 100 : 0;
    
    // CAN-SPAM requires working unsubscribe mechanism
    // Warn if 0% unsubscribe rate with significant contacts (may indicate missing functionality)
    const canSpamStatus = unsubscribeRate === 0 && emailCount > 100 ? "warn" : "pass";

    checks.push({
      name: "CAN-SPAM Compliance",
      status: canSpamStatus,
      message: `${unsubscribedCount} unsubscribed / ${emailCount} contacts (${unsubscribeRate.toFixed(1)}% rate)${canSpamStatus === "warn" ? " — Consider verifying unsubscribe links are working" : ""}`,
    });

    // Check for admin-scoped keys (potential over-privileged access)
    const adminKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.accountId, accountId),
          isNull(apiKeys.revokedAt),
          sql`${apiKeys.scopes}::jsonb ? 'admin'`
        )
      );

    checks.push({
      name: "Privileged API Keys",
      status: adminKeys.length <= 1 ? "pass" : "warn",
      message:
        adminKeys.length <= 1
          ? "Minimal admin-scoped keys"
          : `${adminKeys.length} admin-scoped API keys (consider reducing)`,
    });

    const passed = checks.every((c) => c.status !== "fail");

    return { passed, checks };
  }

  /**
   * Validate Resend webhook signature (HMAC)
   */
  static validateResendWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      const actual = signature.replace("sha256=", "");
      return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
    } catch {
      return false;
    }
  }

  /**
   * Sanitize user input for LLM prompts (prevent injection)
   */
  static sanitizeForLLM(input: string): string {
    return input
      .replace(/```/g, "'''")
      .replace(/<\/?script[^>]*>/gi, "")
      .replace(/\{\{/g, "{ {")
      .replace(/\}\}/g, "} }")
      .slice(0, 10000);
  }

  /**
   * Check if a field name is safe (prevent prototype pollution)
   */
  static isSafeFieldName(name: string): boolean {
    const dangerous = ["__proto__", "constructor", "prototype", "toString", "valueOf"];
    return !dangerous.includes(name) && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitive(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "secret", "key", "token", "apiKey", "authorization"];
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        result[key] = typeof value === "string" ? `***${value.slice(-4)}` : "***";
      } else if (Array.isArray(value)) {
        result[key] = value.map((v) =>
          typeof v === "object" && v !== null
            ? SecurityService.maskSensitive(v as Record<string, unknown>)
            : v
        );
      } else if (typeof value === "object" && value !== null) {
        result[key] = SecurityService.maskSensitive(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Generate GDPR-compliant data export for a contact
   */
  static async exportContactData(accountId: string, contactId: string) {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)))
      .limit(1);

    if (!contact) return null;

    return {
      exportedAt: new Date().toISOString(),
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.companyName,
        createdAt: contact.createdAt,
        customFields: contact.customFields,
      },
    };
  }

  /**
   * Delete all contact data (GDPR right to erasure)
   */
  static async deleteContactData(accountId: string, contactId: string): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));

    return (result.rowCount ?? 0) > 0;
  }
}
