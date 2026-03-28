/**
 * MCP Prompts — 3 reusable prompt templates for OutreachOS
 * Phase 6 implementation
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // ────────────────────────────────────────────
  // 1. Email Drafting Prompt
  // ────────────────────────────────────────────

  server.prompt(
    "email_drafting_prompt",
    "Generate a cold outreach email based on goal, audience, and tone",
    {
      goal: z.string().describe("The primary goal of the email (e.g., book a demo, introduce product)"),
      audience: z.string().describe("Who the email is targeting (e.g., SaaS CTOs, marketing directors)"),
      tone: z.string().describe("Desired tone (e.g., professional, casual, friendly, authoritative)"),
      cta: z.string().optional().describe("Specific call to action"),
      additional_context: z.string().optional().describe("Any additional context or requirements"),
    },
    ({ goal, audience, tone, cta, additional_context }) => {
      const parts = [
        "You are an expert cold email copywriter working within OutreachOS, an AI-powered outreach platform.",
        "",
        "Generate a professional outreach email with the following parameters:",
        "",
        `**Goal:** ${goal}`,
        `**Target Audience:** ${audience}`,
        `**Tone:** ${tone}`,
      ];

      if (cta) parts.push(`**Call to Action:** ${cta}`);
      if (additional_context) parts.push(`**Additional Context:** ${additional_context}`);

      parts.push(
        "",
        "**Requirements:**",
        "- Maximum 150 words",
        "- Exactly 2 paragraphs plus a CTA line",
        "- Use merge tokens: {FirstName}, {CompanyName}, {City} where appropriate",
        "- No subject line — body only",
        "- Return HTML formatted email body",
        "- Make the opening line personalized and attention-grabbing",
        "- End with a clear, low-friction CTA",
        "",
        "Return ONLY the HTML email body. No explanation or preamble.",
      );

      return {
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: parts.join("\n") },
        }],
      };
    },
  );

  // ────────────────────────────────────────────
  // 2. LinkedIn Copy Prompt
  // ────────────────────────────────────────────

  server.prompt(
    "linkedin_copy_prompt",
    "Generate personalized LinkedIn outreach message for a contact",
    {
      contact_name: z.string().describe("Full name of the contact"),
      company: z.string().optional().describe("Contact's company name"),
      linkedin_url: z.string().optional().describe("Contact's LinkedIn profile URL"),
      message_type: z.enum(["connection_request", "inmail", "follow_up"]).describe("Type of LinkedIn message"),
      objective: z.string().describe("What you want to achieve with this message"),
      research_notes: z.string().optional().describe("Any research notes about the contact"),
    },
    ({ contact_name, company, linkedin_url, message_type, objective, research_notes }) => {
      const charLimit = message_type === "connection_request" ? 300 : 2000;
      const typeLabel = message_type === "connection_request" ? "Connection Request" :
        message_type === "inmail" ? "InMail" : "Follow-up Message";

      const parts = [
        "You are an expert LinkedIn outreach strategist working within OutreachOS.",
        "",
        `Generate a personalized LinkedIn ${typeLabel} for the following contact:`,
        "",
        `**Contact:** ${contact_name}`,
      ];

      if (company) parts.push(`**Company:** ${company}`);
      if (linkedin_url) parts.push(`**LinkedIn:** ${linkedin_url}`);
      parts.push(`**Objective:** ${objective}`);
      if (research_notes) parts.push(`**Research Notes:** ${research_notes}`);

      parts.push(
        "",
        "**Requirements:**",
        `- Maximum ${charLimit} characters`,
        "- Be professional but personable",
        "- Reference something specific about the person or their company",
        "- Include a clear reason for connecting/reaching out",
        "- Avoid generic templates — make it feel genuinely personal",
        message_type === "follow_up" ? "- Reference previous interaction naturally" : "",
        "",
        "Return ONLY the message text. No explanation.",
      );

      return {
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: parts.join("\n") },
        }],
      };
    },
  );

  // ────────────────────────────────────────────
  // 3. Follow-up Sequence Prompt
  // ────────────────────────────────────────────

  server.prompt(
    "follow_up_sequence_prompt",
    "Generate a multi-step follow-up email sequence for a journey/funnel",
    {
      initial_email_context: z.string().describe("Description or content of the initial email"),
      num_follow_ups: z.string().describe("Number of follow-up emails to generate (1-4)"),
      tone: z.string().describe("Desired tone for the sequence"),
      objective: z.string().describe("Overall objective of the sequence"),
      days_between: z.string().optional().describe("Days between each follow-up (default: 3)"),
    },
    ({ initial_email_context, num_follow_ups, tone, objective, days_between }) => {
      const count = Math.min(parseInt(num_follow_ups) || 2, 4);
      const gap = parseInt(days_between ?? "3") || 3;

      const parts = [
        "You are an expert email sequence strategist working within OutreachOS.",
        "",
        "Generate a follow-up email sequence based on this initial outreach:",
        "",
        `**Initial Email Context:** ${initial_email_context}`,
        `**Overall Objective:** ${objective}`,
        `**Tone:** ${tone}`,
        `**Number of Follow-ups:** ${count}`,
        `**Days Between Emails:** ${gap}`,
        "",
        "**Requirements for each follow-up:**",
        "- Each email should be shorter than the previous one",
        "- Vary the approach: add value, share social proof, create urgency, final attempt",
        "- Use merge tokens: {FirstName}, {CompanyName} where appropriate",
        "- Include subject line and HTML body for each",
        "- The final email should be a 'breakup' or 'last chance' style",
        "",
        "**Return format (JSON array):**",
        "```json",
        "[",
        '  { "step": 1, "name": "First Follow Up", "delay_days": N, "subject": "...", "body_html": "..." },',
        '  { "step": 2, "name": "Second Follow Up", "delay_days": N, "subject": "...", "body_html": "..." }',
        "]",
        "```",
        "",
        "Return ONLY the JSON array. No explanation.",
      ];

      return {
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: parts.join("\n") },
        }],
      };
    },
  );
}
