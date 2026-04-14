/**
 * LLMService — Gemini 2.5 Pro + OpenRouter routing, prompt construction, usage logging
 * Phase 4: Gemini primary provider
 * Phase 6: OpenRouter fallback, routing abstraction, BYOK support
 */

import { GoogleGenAI } from "@google/genai";
import { accounts, db, llmUsageLog } from "@outreachos/db";
import { eq, gte, sql, and } from "drizzle-orm";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 4096;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Monthly platform-key token quota per account (input + output tokens combined) */
const PLATFORM_MONTHLY_TOKEN_QUOTA = (() => {
  const raw = process.env.PLATFORM_MONTHLY_TOKEN_QUOTA ?? "500000";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Invalid PLATFORM_MONTHLY_TOKEN_QUOTA value "${raw}". Must be a non-negative number.`,
    );
  }
  return Math.floor(parsed);
})();
const PLATFORM_QUOTA_RESERVATION_PROVIDER = "platform_quota_reservation";
const PLATFORM_QUOTA_RESERVATION_MODEL = "quota_reservation";

export type LLMProvider = "gemini" | "openrouter";
export type RoutingMode = "auto" | "manual";

export interface LLMConfig {
  apiKey: string;
  model?: string;
  provider?: LLMProvider;
  fallbackApiKey?: string;
  routingMode?: RoutingMode;
  /** True when using the platform-managed key (enables quota enforcement) */
  usingPlatformKey?: boolean;
}

export interface GenerateEmailOptions {
  goal: string;
  audience: string;
  tone: string;
  cta?: string;
  maxWords?: number;
  additionalInstructions?: string;
}

export interface SubjectLineOptions {
  emailBody: string;
  tone: string;
  maxWords?: number;
  count?: number;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export class LLMService {
  /** Generate email body from structured prompt */
  static async generateEmail(
    accountId: string,
    config: LLMConfig,
    options: GenerateEmailOptions,
  ): Promise<LLMResponse> {
    const prompt = LLMService.buildEmailPrompt(options);
    return LLMService.generate(accountId, config, prompt, "email_generation");
  }

  /** Generate subject line variants */
  static async generateSubjectLines(
    accountId: string,
    config: LLMConfig,
    options: SubjectLineOptions,
  ): Promise<LLMResponse> {
    const count = options.count ?? 3;
    const maxWords = options.maxWords ?? 6;
    const prompt = [
      `Generate exactly ${count} email subject line variants.`,
      `Tone: ${options.tone}`,
      `Max ${maxWords} words each.`,
      `Return ONLY a JSON array of strings, no explanation.`,
      "",
      "Email body for context:",
      options.emailBody,
    ].join("\n");

    return LLMService.generate(accountId, config, prompt, "subject_generation");
  }

  /** Rewrite/improve existing email content */
  static async rewriteEmail(
    accountId: string,
    config: LLMConfig,
    currentBody: string,
    instruction: string,
  ): Promise<LLMResponse> {
    const prompt = [
      "You are an expert email copywriter. Rewrite the following email based on the instruction.",
      "",
      "Instruction:",
      instruction,
      "",
      "Current email:",
      currentBody,
      "",
      "Return ONLY the rewritten email body (HTML). No explanation.",
    ].join("\n");

    return LLMService.generate(accountId, config, prompt, "email_rewrite");
  }

  /** Generate LinkedIn copy for outreach */
  static async generateLinkedInCopy(
    accountId: string,
    config: LLMConfig,
    contactInfo: { name: string; company?: string; linkedinUrl?: string },
    promptInstructions: string,
    researchNotes?: string,
  ): Promise<LLMResponse> {
    const parts = [
      "You are an expert LinkedIn outreach copywriter. Generate a personalized LinkedIn connection/message.",
      "",
      `Contact: ${contactInfo.name}`,
    ];
    if (contactInfo.company) parts.push(`Company: ${contactInfo.company}`);
    if (contactInfo.linkedinUrl) parts.push(`LinkedIn: ${contactInfo.linkedinUrl}`);
    parts.push("", "Instructions:", promptInstructions);
    if (researchNotes) parts.push("", "Research notes:", researchNotes);
    parts.push(
      "",
      "Requirements:",
      "- Keep it under 300 characters for connection requests, or under 500 words for InMail",
      "- Be professional but personable",
      "- Reference something specific about the person or company",
      "- Include a clear reason for connecting",
      "",
      "Return ONLY the message text. No explanation.",
    );

    return LLMService.generate(accountId, config, parts.join("\n"), "linkedin_copy");
  }

  /** Core generation method with provider routing and auto-fallback */
  static async generate(
    accountId: string,
    config: LLMConfig,
    prompt: string,
    purpose: string,
  ): Promise<LLMResponse> {
    const provider = config.provider ?? "gemini";
    const routingMode = config.routingMode ?? "auto";
    const quotaReservationId = config.usingPlatformKey
      ? await LLMService.reservePlatformQuota(accountId, prompt, purpose)
      : undefined;

    try {
      if (provider === "openrouter") {
        return await LLMService.generateViaOpenRouter(accountId, config, prompt, purpose, quotaReservationId);
      }
      return await LLMService.generateViaGemini(accountId, config, prompt, purpose, quotaReservationId);
    } catch (err) {
      // Auto-fallback to OpenRouter if Gemini fails and fallback key available
      if (provider === "gemini" && routingMode === "auto" && config.fallbackApiKey) {
        console.warn("Gemini failed, falling back to OpenRouter:", err instanceof Error ? err.message : err);
        const fallbackConfig: LLMConfig = {
          ...config,
          apiKey: config.fallbackApiKey,
          provider: "openrouter",
        };
        try {
          return await LLMService.generateViaOpenRouter(accountId, fallbackConfig, prompt, purpose, quotaReservationId);
        } catch (fallbackErr) {
          if (quotaReservationId) {
            await LLMService.releasePlatformQuotaReservation(quotaReservationId);
          }
          throw fallbackErr;
        }
      }
      if (quotaReservationId) {
        await LLMService.releasePlatformQuotaReservation(quotaReservationId);
      }
      throw err;
    }
  }

  private static async reservePlatformQuota(
    accountId: string,
    prompt: string,
    purpose: string,
  ): Promise<string> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const reservedInputTokens = Math.max(Buffer.byteLength(prompt, "utf8"), 256);
    const reservedOutputTokens = MAX_OUTPUT_TOKENS;
    const reservedTotalTokens = reservedInputTokens + reservedOutputTokens;

    return db.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .for("update");

      if (!account) {
        throw new Error("ACCOUNT_NOT_FOUND: Account not found");
      }

      const [row] = await tx
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${llmUsageLog.inputTokens} + ${llmUsageLog.outputTokens}), 0)`,
        })
        .from(llmUsageLog)
        .where(
          and(
            eq(llmUsageLog.accountId, accountId),
            gte(llmUsageLog.createdAt, monthStart),
          ),
        );

      const used = Number(row?.totalTokens ?? 0);
      if (used + reservedTotalTokens > PLATFORM_MONTHLY_TOKEN_QUOTA) {
        throw new Error(
          `QUOTA_EXCEEDED: Monthly platform token quota reached (${used.toLocaleString()} / ${PLATFORM_MONTHLY_TOKEN_QUOTA.toLocaleString()}). ` +
          "Add a BYOK API key in Settings to continue generating.",
        );
      }

      const [reservation] = await tx
        .insert(llmUsageLog)
        .values({
          accountId,
          provider: PLATFORM_QUOTA_RESERVATION_PROVIDER,
          model: PLATFORM_QUOTA_RESERVATION_MODEL,
          purpose: `quota_reservation:${purpose}`,
          inputTokens: reservedInputTokens,
          outputTokens: reservedOutputTokens,
          latencyMs: 0,
        })
        .returning({ id: llmUsageLog.id });

      if (!reservation) {
        throw new Error("LLM_USAGE_RESERVATION_FAILED: Failed to reserve platform quota");
      }

      return reservation.id;
    });
  }

  private static async releasePlatformQuotaReservation(reservationId: string): Promise<void> {
    try {
      await db.delete(llmUsageLog).where(eq(llmUsageLog.id, reservationId));
    } catch (releaseErr) {
      console.error("Failed to release LLM quota reservation:", releaseErr);
    }
  }

  /** Generate via Gemini (Google AI) */
  private static async generateViaGemini(
    accountId: string,
    config: LLMConfig,
    prompt: string,
    purpose: string,
    quotaReservationId?: string,
  ): Promise<LLMResponse> {
    const model = config.model ?? DEFAULT_GEMINI_MODEL;
    const client = new GoogleGenAI({ apiKey: config.apiKey });

    const start = Date.now();

    let response;
    try {
      response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
    } catch (err) {
      throw LLMService.mapError(err);
    }

    const latencyMs = Date.now() - start;
    const text = response.text ?? "";
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    await LLMService.logUsage(accountId, "google", model, purpose, inputTokens, outputTokens, latencyMs, quotaReservationId);

    return { text, inputTokens, outputTokens, latencyMs };
  }

  /** Generate via OpenRouter (OpenAI-compatible API) */
  private static async generateViaOpenRouter(
    accountId: string,
    config: LLMConfig,
    prompt: string,
    purpose: string,
    quotaReservationId?: string,
  ): Promise<LLMResponse> {
    const model = config.model ?? DEFAULT_OPENROUTER_MODEL;
    const start = Date.now();

    let data: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://outreachos.com",
          "X-Title": "OutreachOS",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`OpenRouter ${res.status}: ${errBody.slice(0, 200)}`);
      }

      data = await res.json();
    } catch (err) {
      throw LLMService.mapError(err);
    }

    const latencyMs = Date.now() - start;
    const text = data.choices?.[0]?.message?.content ?? "";
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    await LLMService.logUsage(accountId, "openrouter", model, purpose, inputTokens, outputTokens, latencyMs, quotaReservationId);

    return { text, inputTokens, outputTokens, latencyMs };
  }

  /** Log LLM usage to DB — never fails the main response */
  private static async logUsage(
    accountId: string,
    provider: string,
    model: string,
    purpose: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    quotaReservationId?: string,
  ): Promise<void> {
    try {
      if (quotaReservationId) {
        const [updated] = await db
          .update(llmUsageLog)
          .set({
            provider,
            model,
            purpose,
            inputTokens,
            outputTokens,
            latencyMs,
          })
          .where(eq(llmUsageLog.id, quotaReservationId))
          .returning({ id: llmUsageLog.id });

        if (updated) {
          return;
        }
      }

      await db.insert(llmUsageLog).values({
        accountId,
        provider,
        model,
        purpose,
        inputTokens,
        outputTokens,
        latencyMs,
      });
    } catch (logErr) {
      console.error("Failed to log LLM usage:", logErr);
    }
  }

  /** Map provider errors to typed errors */
  private static mapError(err: unknown): Error {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("ratelimit")) {
      return new Error("RATE_LIMIT_EXCEEDED: LLM API rate limit exceeded. Please retry later.");
    }
    if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("authentication")) {
      return new Error("AUTH_ERROR: LLM API authentication failed. Check your API key.");
    }
    if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("econnrefused")) {
      return new Error("NETWORK_ERROR: LLM API network timeout. Please retry.");
    }
    return new Error(`LLM_GENERATION_ERROR: ${message}`);
  }

  /** Build structured email generation prompt */
  private static buildEmailPrompt(options: GenerateEmailOptions): string {
    const maxWords = options.maxWords ?? 150;
    const parts = [
      "You are an expert cold email copywriter. Generate a professional outreach email.",
      "",
      `Goal: ${options.goal}`,
      `Target audience: ${options.audience}`,
      `Tone: ${options.tone}`,
    ];

    if (options.cta) {
      parts.push(`Call to action: ${options.cta}`);
    }

    parts.push(
      "",
      "Requirements:",
      `- Maximum ${maxWords} words`,
      "- Exactly 2 paragraphs plus a CTA line",
      "- Use merge tokens like {FirstName}, {CompanyName} where appropriate",
      "- No subject line — body only",
      "- Return HTML formatted email body",
    );

    if (options.additionalInstructions) {
      parts.push("", "Additional instructions:", options.additionalInstructions);
    }

    parts.push("", "Return ONLY the HTML email body. No explanation or preamble.");

    return parts.join("\n");
  }
}
