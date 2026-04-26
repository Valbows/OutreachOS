/**
 * External API Usage Tracking Service
 * Tracks per-key usage for LLM, Hunter.io, and Resend APIs
 */

import { createHash } from "crypto";
import { db, llmUsageLog, hunterUsageLog, resendUsageLog } from "@outreachos/db";

export interface LlmUsageInput {
  accountId: string;
  apiKeyId?: string;
  provider: string;
  model: string;
  purpose: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  cost?: number;
}

export interface HunterUsageInput {
  accountId: string;
  apiKeyId?: string;
  domain?: string;
  /** Raw email — will be SHA-256 hashed before storage; never persisted in plaintext */
  email?: string;
  endpoint: "domain_search" | "email_finder" | "email_verifier" | "account_information";
  requestsUsed?: number;
  resultFound?: boolean;
  latencyMs?: number;
}

export interface ResendUsageInput {
  accountId: string;
  apiKeyId?: string;
  campaignId?: string;
  contactId?: string;
  messageId?: string;
  status: "sent" | "delivered" | "bounced" | "complained" | "opened" | "clicked";
  emailCount?: number;
  latencyMs?: number;
}

export class ExternalApiUsageService {
  /** Record LLM API usage */
  static async recordLlmUsage(input: LlmUsageInput): Promise<boolean> {
    try {
      await db.insert(llmUsageLog).values({
        accountId: input.accountId,
        apiKeyId: input.apiKeyId,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        cost: input.cost,
      });
      return true;
    } catch (err) {
      console.error("[ExternalApiUsage] Failed to record LLM usage:", err);
      return false;
    }
  }

  /** Record Hunter.io API usage */
  static async recordHunterUsage(input: HunterUsageInput): Promise<void> {
    try {
      const emailHash = input.email
        ? createHash("sha256").update(input.email.toLowerCase().trim()).digest("hex")
        : undefined;
      await db.insert(hunterUsageLog).values({
        accountId: input.accountId,
        apiKeyId: input.apiKeyId,
        domain: input.domain,
        emailHash,
        endpoint: input.endpoint,
        requestsUsed: input.requestsUsed ?? 1,
        resultFound: input.resultFound === true ? 1 : input.resultFound === false ? 0 : null,
        latencyMs: input.latencyMs,
      });
    } catch (err) {
      console.error("[ExternalApiUsage] Failed to record Hunter usage:", err);
    }
  }

  /** Record Resend email API usage */
  static async recordResendUsage(input: ResendUsageInput): Promise<void> {
    try {
      await db.insert(resendUsageLog).values({
        accountId: input.accountId,
        apiKeyId: input.apiKeyId,
        campaignId: input.campaignId,
        contactId: input.contactId,
        messageId: input.messageId,
        status: input.status,
        emailCount: input.emailCount ?? 1,
        latencyMs: input.latencyMs,
      });
    } catch (err) {
      console.error("[ExternalApiUsage] Failed to record Resend usage:", err);
    }
  }

  /** Get usage summary by API key for a given time period */
  static async getUsageByApiKey(
    apiKeyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    llmRequests: number;
    llmTokens: number;
    hunterRequests: number;
    hunterResultsFound: number;
    resendEmails: number;
  }> {
    const llmStats = await db.query.llmUsageLog.findMany({
      where: (log, { eq, and, gte, lte }) =>
        and(
          eq(log.apiKeyId, apiKeyId),
          gte(log.createdAt, startDate),
          lte(log.createdAt, endDate)
        ),
    });

    const hunterStats = await db.query.hunterUsageLog.findMany({
      where: (log, { eq, and, gte, lte }) =>
        and(
          eq(log.apiKeyId, apiKeyId),
          gte(log.createdAt, startDate),
          lte(log.createdAt, endDate)
        ),
    });

    const resendStats = await db.query.resendUsageLog.findMany({
      where: (log, { eq, and, gte, lte }) =>
        and(
          eq(log.apiKeyId, apiKeyId),
          gte(log.createdAt, startDate),
          lte(log.createdAt, endDate)
        ),
    });

    // Calculate aggregates
    return {
      llmRequests: llmStats.length,
      llmTokens: llmStats.reduce((sum, log) => sum + (log.inputTokens || 0) + (log.outputTokens || 0), 0),
      hunterRequests: hunterStats.reduce((sum, log) => sum + (log.requestsUsed || 0), 0),
      hunterResultsFound: hunterStats.filter((log) => log.resultFound === 1).length,
      resendEmails: resendStats.reduce((sum, log) => sum + (log.emailCount || 0), 0),
    };
  }
}
