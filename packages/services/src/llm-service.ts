/**
 * LLMService — Gemini 2.5 Pro + OpenRouter routing, prompt construction, usage logging
 * Implemented in Phase 4 (Gemini), Phase 6 (OpenRouter routing)
 */

import { GoogleGenAI } from "@google/genai";
import { db, llmUsageLog } from "@outreachos/db";

const DEFAULT_MODEL = "gemini-2.5-pro-preview-05-06";
const MAX_OUTPUT_TOKENS = 4096;

export interface LLMConfig {
  apiKey: string;
  model?: string;
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

  /** Core generation method — calls Gemini and logs usage */
  static async generate(
    accountId: string,
    config: LLMConfig,
    prompt: string,
    purpose: string,
  ): Promise<LLMResponse> {
    const model = config.model ?? DEFAULT_MODEL;
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
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      // Map common GoogleGenAI errors to typed errors
      if (lower.includes("429") || lower.includes("rate limit") || lower.includes("ratelimit")) {
        throw new Error("RATE_LIMIT_EXCEEDED: LLM API rate limit exceeded. Please retry later.");
      }
      if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("authentication")) {
        throw new Error("AUTH_ERROR: LLM API authentication failed. Check your API key.");
      }
      if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("econnrefused")) {
        throw new Error("NETWORK_ERROR: LLM API network timeout. Please retry.");
      }
      throw new Error(`LLM_GENERATION_ERROR: ${message}`);
    }

    const latencyMs = Date.now() - start;
    const text = response.text ?? "";
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    // Log usage to DB — don't fail the response if logging fails
    try {
      await db.insert(llmUsageLog).values({
        accountId,
        provider: "google",
        model,
        purpose,
        inputTokens,
        outputTokens,
        latencyMs,
      });
    } catch (logErr) {
      console.error("Failed to log LLM usage:", logErr);
    }

    return { text, inputTokens, outputTokens, latencyMs };
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
