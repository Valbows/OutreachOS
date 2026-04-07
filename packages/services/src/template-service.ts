/**
 * TemplateService — Template CRUD, import, token system, rendering
 * Implemented in Phase 4
 */

import { db, templates } from "@outreachos/db";
import { eq, and, desc } from "drizzle-orm";
import mammoth from "mammoth";

// Built-in merge tokens supported in templates
const BUILT_IN_TOKENS = [
  "FirstName",
  "LastName",
  "CompanyName",
  "BusinessWebsite",
  "City",
  "State",
  "Email",
] as const;

const TOKEN_REGEX = /\{(\w+)\}/g;

export interface CreateTemplateInput {
  accountId: string;
  name: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  tokenFallbacks?: Record<string, string>;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  tokenFallbacks?: Record<string, string>;
}

export interface RenderContext {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  businessWebsite?: string;
  city?: string;
  state?: string;
  email?: string;
  [key: string]: string | undefined;
}

export class TemplateService {
  /** List templates for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(templates)
      .where(eq(templates.accountId, accountId))
      .orderBy(desc(templates.updatedAt));
  }

  /** Get a single template by ID (scoped to account) */
  static async getById(accountId: string, templateId: string) {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.accountId, accountId)))
      .limit(1);
    return template ?? null;
  }

  /** Create a new template, auto-extracting tokens from body */
  static async create(input: CreateTemplateInput) {
    const tokens = TemplateService.extractTokens(input.bodyHtml ?? "");
    const [template] = await db
      .insert(templates)
      .values({
        accountId: input.accountId,
        name: input.name,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText ?? TemplateService.stripHtml(input.bodyHtml ?? ""),
        tokens,
        tokenFallbacks: input.tokenFallbacks ?? {},
        version: 1,
      })
      .returning();
    return template;
  }

  /** Update a template, creating a new version with optimistic locking */
  static async update(accountId: string, templateId: string, input: UpdateTemplateInput) {
    const existing = await TemplateService.getById(accountId, templateId);
    if (!existing) return null;

    const bodyHtml = input.bodyHtml ?? existing.bodyHtml;
    const tokens = bodyHtml ? TemplateService.extractTokens(bodyHtml) : existing.tokens;

    const [updated] = await db
      .update(templates)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.bodyHtml !== undefined && { bodyHtml: input.bodyHtml }),
        ...(input.bodyText !== undefined
          ? { bodyText: input.bodyText }
          : input.bodyHtml !== undefined
            ? { bodyText: TemplateService.stripHtml(input.bodyHtml) }
            : {}),
        ...(input.tokenFallbacks !== undefined && { tokenFallbacks: input.tokenFallbacks }),
        tokens,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(templates.id, templateId),
          eq(templates.accountId, accountId),
          eq(templates.version, existing.version), // Optimistic locking: only update if version matches
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Template was modified by another request. Please retry.");
    }

    return updated;
  }

  /** Delete a template */
  static async delete(accountId: string, templateId: string) {
    await db
      .delete(templates)
      .where(and(eq(templates.id, templateId), eq(templates.accountId, accountId)));
  }

  /** Duplicate a template (for A/B variants) */
  static async duplicate(accountId: string, templateId: string, newName?: string) {
    const original = await TemplateService.getById(accountId, templateId);
    if (!original) return null;

    return TemplateService.create({
      accountId,
      name: newName ?? `${original.name} (Copy)`,
      subject: original.subject ?? undefined,
      bodyHtml: original.bodyHtml ?? undefined,
      bodyText: original.bodyText ?? undefined,
      tokenFallbacks: (original.tokenFallbacks as Record<string, string>) ?? undefined,
    });
  }

  /** Render a template with contact data, replacing tokens with values or fallbacks */
  static render(
    bodyHtml: string,
    context: RenderContext,
    fallbacks: Record<string, string> = {},
  ): string {
    return bodyHtml.replace(TOKEN_REGEX, (match, tokenName: string) => {
      // Convert token name to camelCase key for context lookup
      const key = tokenName.charAt(0).toLowerCase() + tokenName.slice(1);
      const value = context[key];
      if (value) return TemplateService.escapeHtml(value);
      // Check fallbacks
      if (fallbacks[tokenName]) return TemplateService.escapeHtml(fallbacks[tokenName]);
      // Return original token if no value or fallback
      return match;
    });
  }

  /** Render a subject line with contact data */
  static renderSubject(
    subject: string,
    context: RenderContext,
    fallbacks: Record<string, string> = {},
  ): string {
    return TemplateService.render(subject, context, fallbacks);
  }

  /** Extract all token names from template HTML */
  static extractTokens(html: string): string[] {
    const tokens = new Set<string>();
    // Use matchAll with the global regex to find all matches
    const matches = html.matchAll(TOKEN_REGEX);
    for (const match of matches) {
      tokens.add(match[1]);
    }
    return Array.from(tokens);
  }

  /** Get list of built-in tokens */
  static getBuiltInTokens(): readonly string[] {
    return BUILT_IN_TOKENS;
  }

  /** Import plaintext or markdown content as a template */
  static async importFromText(
    accountId: string,
    name: string,
    content: string,
    format: "text" | "markdown" | "html" = "text",
  ) {
    let bodyHtml: string;
    if (format === "html") {
      bodyHtml = content;
    } else if (format === "markdown") {
      // Basic markdown → HTML conversion (bold, italic, links, paragraphs)
      bodyHtml = TemplateService.markdownToHtml(content);
    } else {
      // Wrap plain text in paragraphs
      bodyHtml = content
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("\n");
    }

    return TemplateService.create({ accountId, name, bodyHtml });
  }

  /** Import .docx file content as a template using Mammoth.js */
  static async importFromDocx(
    accountId: string,
    name: string,
    buffer: Buffer,
  ) {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      // Clean up HTML: remove empty paragraphs, normalize spacing
      const bodyHtml = result.value
        .replace(/<p>\s*<\/p>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return TemplateService.create({ accountId, name, bodyHtml });
    } catch (err) {
      const originalMessage = err instanceof Error ? err.message : String(err);
      console.error("[TemplateService] DOCX conversion failed", {
        accountId,
        templateName: name,
        error: originalMessage,
      });
      throw new Error(`Failed to convert DOCX to HTML for template "${name}": ${originalMessage}`);
    }
  }

  /** Markdown to HTML conversion with stateful parser for block elements */
  private static markdownToHtml(md: string): string {
    const lines = md.split("\n");
    const output: string[] = [];
    const openTags: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let inList = false;
    let listType: "ul" | "ol" | null = null;
    let listIndent = 0;

    const flushCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        const code = TemplateService.escapeHtml(codeBlockContent.join("\n"));
        output.push(`<pre><code>${code}</code></pre>`);
        codeBlockContent = [];
      }
      inCodeBlock = false;
    };

    const closeList = () => {
      if (inList && listType) {
        output.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
    };

    const flushOpenTags = () => {
      while (openTags.length > 0) {
        output.push(openTags.pop()!);
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code blocks (fenced)
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
          closeList();
          inCodeBlock = true;
          codeBlockContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Inline code (single backticks) - process later
      // Blockquote
      if (trimmed.startsWith("> ")) {
        closeList();
        const content = trimmed.slice(2);
        output.push(`<blockquote>${TemplateService.processInline(content)}</blockquote>`);
        continue;
      }

      // Headers
      if (trimmed.match(/^#{1,6}\s/)) {
        closeList();
        const level = trimmed.match(/^(#+)/)?.[0].length ?? 1;
        const content = trimmed.slice(level).trim();
        output.push(`<h${level}>${TemplateService.processInline(content)}</h${level}>`);
        continue;
      }

      // Horizontal rule
      if (trimmed.match(/^(---|___|\*\*\*)$/)) {
        closeList();
        output.push("<hr>");
        continue;
      }

      // Lists - match against original line to capture leading whitespace
      const ulMatch = line.match(/^(\s*)[-*+]\s+/);
      const olMatch = line.match(/^(\s*)\d+\.\s+/);

      if (ulMatch || olMatch) {
        const indent = (ulMatch || olMatch)![1].length;
        const newListType: "ul" | "ol" = ulMatch ? "ul" : "ol";

        if (!inList || listType !== newListType) {
          closeList();
          output.push(`<${newListType}>`);
          inList = true;
          listType = newListType;
          listIndent = indent;
        }

        const content = trimmed.slice(trimmed.indexOf(" ") + 1);
        output.push(`<li>${TemplateService.processInline(content)}</li>`);
        continue;
      }

      // End of list
      if (inList && trimmed.length > 0) {
        closeList();
      }

      // Empty line - paragraph break
      if (trimmed.length === 0) {
        if (openTags.length > 0) {
          flushOpenTags();
        }
        continue;
      }

      // Regular paragraph
      if (openTags.length === 0) {
        output.push(`<p>${TemplateService.processInline(trimmed)}`);
        openTags.push("</p>");
      } else {
        // Append to current paragraph with line break
        output[output.length - 1] += "<br>" + TemplateService.processInline(trimmed);
      }
    }

    // Flush remaining state
    flushCodeBlock();
    closeList();
    flushOpenTags();

    return output.join("\n");
  }

  /** Process inline markdown elements (bold, italic, links, code) */
  private static processInline(text: string): string {
    return text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  /** HTML escape special characters to prevent injection */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  /** Strip HTML tags to produce plain text version */
  private static stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }
}
