/**
 * CampaignService — Campaign CRUD, send orchestration, scheduling
 * Implemented in Phase 4
 */

import { Resend } from "resend";
import {
  db,
  campaigns,
  messageInstances,
  emailEvents,
  contacts,
  templates,
} from "@outreachos/db";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { TemplateService, type RenderContext } from "./template-service.js";
import { LLMService, type LLMConfig } from "./llm-service.js";

const COMPLAINT_RATE_THRESHOLD = 0.001; // 0.1% — auto-pause if exceeded
const BATCH_SEND_DELAY_MS = 100; // ~10 emails/s to stay within Resend rate limits
const MAX_RETRIES = 3; // Max retry attempts for transient Resend errors

export type CampaignType = "one_time" | "journey" | "funnel" | "ab_test" | "newsletter";
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "stopped";

export interface CreateCampaignInput {
  accountId: string;
  name: string;
  type: CampaignType;
  groupId?: string;
  templateId?: string;
  scheduledAt?: Date;
  settings?: Record<string, unknown>;
}

export interface UpdateCampaignInput {
  name?: string;
  groupId?: string;
  templateId?: string;
  scheduledAt?: Date | null;
  settings?: Record<string, unknown>;
  status?: CampaignStatus;
}

export interface SendConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export interface SendProgress {
  total: number;
  sent: number;
  failed: number;
}

export interface WebhookEvent {
  type: string;
  data: {
    email_id: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export class CampaignService {
  // === Campaign CRUD ===

  /** List campaigns for an account */
  static async list(accountId: string, status?: CampaignStatus) {
    const conditions = [eq(campaigns.accountId, accountId)];
    if (status) {
      conditions.push(eq(campaigns.status, status));
    }
    return db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.updatedAt));
  }

  /** Get a single campaign by ID (scoped to account) */
  static async getById(accountId: string, campaignId: string) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.accountId, accountId)))
      .limit(1);
    return campaign ?? null;
  }

  /** Create a new campaign */
  static async create(input: CreateCampaignInput) {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        accountId: input.accountId,
        name: input.name,
        type: input.type,
        status: "draft",
        groupId: input.groupId,
        templateId: input.templateId,
        scheduledAt: input.scheduledAt,
        settings: input.settings,
      })
      .returning();
    return campaign;
  }

  /** Update a campaign */
  static async update(accountId: string, campaignId: string, input: UpdateCampaignInput) {
    const [updated] = await db
      .update(campaigns)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.groupId !== undefined && { groupId: input.groupId }),
        ...(input.templateId !== undefined && { templateId: input.templateId }),
        ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
        ...(input.settings !== undefined && { settings: input.settings }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.accountId, accountId)))
      .returning();
    return updated ?? null;
  }

  /** Delete a campaign - returns true if deleted, false if not found */
  static async delete(accountId: string, campaignId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.accountId, accountId)))
      .returning({ id: campaigns.id });
    return !!deleted;
  }

  // === Email Sending ===

  /** Send a campaign to all contacts in the group */
  static async sendCampaign(
    accountId: string,
    campaignId: string,
    config: SendConfig,
    onProgress?: (progress: SendProgress) => void,
  ): Promise<SendProgress> {
    const campaign = await CampaignService.getById(accountId, campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.templateId) throw new Error("Campaign has no template assigned");

    const template = await TemplateService.getById(accountId, campaign.templateId);
    if (!template) throw new Error("Template not found");
    if (!template.subject) throw new Error("Template has no subject line");
    if (!template.bodyHtml) throw new Error("Template has no body content");

    // Get contacts in the campaign's group
    const contactList = await CampaignService.getCampaignContacts(accountId, campaign.groupId);

    const progress: SendProgress = { total: contactList.length, sent: 0, failed: 0 };

    // Mark campaign as active
    await CampaignService.update(accountId, campaignId, { status: "active" });
    await db
      .update(campaigns)
      .set({ startedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    const resend = new Resend(config.resendApiKey);
    const fallbacks = (template.tokenFallbacks as Record<string, string>) ?? {};

    let wasAutoPaused = false;
    let retryCount = 0;

    for (const contact of contactList) {
      retryCount = 0;
      
      // Skip unsubscribed contacts
      if (contact.unsubscribed) {
        progress.total--;
        continue;
      }

      if (!contact.email) {
        progress.failed++;
        onProgress?.(progress);
        continue;
      }

      // Build render context from contact data
      const context: RenderContext = {
        firstName: contact.firstName ?? undefined,
        lastName: contact.lastName ?? undefined,
        companyName: contact.companyName ?? undefined,
        businessWebsite: contact.businessWebsite ?? undefined,
        city: contact.city ?? undefined,
        state: contact.state ?? undefined,
        email: contact.email ?? undefined,
      };

      const renderedSubject = TemplateService.renderSubject(template.subject, context, fallbacks);
      const renderedHtml = TemplateService.render(template.bodyHtml, context, fallbacks);

      let sent = false;
      while (!sent && retryCount < MAX_RETRIES) {
        try {
          const result = await resend.emails.send({
            from: config.fromName
              ? `${config.fromName} <${config.fromEmail}>`
              : config.fromEmail,
            to: contact.email,
            subject: renderedSubject,
            html: renderedHtml,
            replyTo: config.replyTo,
          });

          // Create message instance record
          await db.insert(messageInstances).values({
            campaignId,
            contactId: contact.id,
            templateId: template.id,
            resendMessageId: result.data?.id ?? null,
            subject: renderedSubject,
            status: "sent",
            sentAt: new Date(),
          });

          progress.sent++;
          sent = true;
        } catch (err) {
          retryCount++;
          const errorCode = CampaignService.getResendErrorCode(err);
          const isRetryable = CampaignService.isRetryableError(errorCode);

          if (isRetryable && retryCount < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, retryCount - 1) * 1000;
            await CampaignService.delay(backoffMs);
          } else {
            // Final failure - record and stop retrying
            await db.insert(messageInstances).values({
              campaignId,
              contactId: contact.id,
              templateId: template.id,
              subject: renderedSubject,
              status: "failed",
            });
            progress.failed++;
            break;
          }
        }
      }

      onProgress?.(progress);

      // Check complaint rate and auto-pause if threshold exceeded
      if (progress.sent > 0 && progress.sent % 50 === 0) {
        const shouldPause = await CampaignService.checkComplaintRate(campaignId);
        if (shouldPause) {
          await CampaignService.update(accountId, campaignId, { status: "paused" });
          wasAutoPaused = true;
          break;
        }
      }

      // Throttle to stay within rate limits
      await CampaignService.delay(BATCH_SEND_DELAY_MS);
    }

    // Mark campaign as completed if all sent (unless auto-paused)
    if (!wasAutoPaused) {
      const finalStatus = progress.total > 0 && progress.failed === progress.total ? "stopped" : "completed";
      await CampaignService.update(accountId, campaignId, { status: finalStatus });
      await db
        .update(campaigns)
        .set({ completedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    return progress;
  }

  /** Send campaign with LLM-generated personalized emails per contact (Individual mode) */
  static async sendCampaignIndividual(
    accountId: string,
    campaignId: string,
    config: SendConfig,
    llmConfig: LLMConfig,
    promptTemplate: string,
    onProgress?: (progress: SendProgress) => void,
  ): Promise<SendProgress> {
    const campaign = await CampaignService.getById(accountId, campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const contactList = await CampaignService.getCampaignContacts(accountId, campaign.groupId);
    const progress: SendProgress = { total: contactList.length, sent: 0, failed: 0 };

    // Mark campaign as active
    await CampaignService.update(accountId, campaignId, { status: "active" });
    await db
      .update(campaigns)
      .set({ startedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    const resend = new Resend(config.resendApiKey);
    let wasAutoPaused = false;

    for (const contact of contactList) {
      // Skip unsubscribed contacts
      if (contact.unsubscribed) {
        progress.total--;
        continue;
      }

      if (!contact.email) {
        progress.failed++;
        onProgress?.(progress);
        continue;
      }

      try {
        // Generate personalized email via LLM
        const contactContext = {
          firstName: contact.firstName ?? "",
          lastName: contact.lastName ?? "",
          companyName: contact.companyName ?? "",
          businessWebsite: contact.businessWebsite ?? "",
          city: contact.city ?? "",
          state: contact.state ?? "",
          email: contact.email ?? "",
        };

        const personalizedPrompt = promptTemplate.replace(
          /\{(\w+)\}/g,
          (match, key) => contactContext[key as keyof typeof contactContext] || match
        );

        const llmResult = await LLMService.generateEmail(accountId, llmConfig, {
          goal: personalizedPrompt,
          audience: `${contact.firstName || "Contact"} at ${contact.companyName || "their company"}`,
          tone: "professional",
          cta: "Reply to schedule a conversation",
        });

        // Extract subject from generated content (first line) or use default
        const lines = llmResult.text.split('\n').filter(l => l.trim());
        const subject = lines[0]?.replace(/^Subject:\s*/i, '') || "Introduction";
        const bodyLines = lines.slice(1).filter(Boolean);
        const bodyContent = bodyLines.length > 0 ? bodyLines.join('\n').trim() : "<p></p>";
        const bodyHtml = CampaignService.convertPlainTextToHtml(bodyContent);

        let retryCount = 0;
        let sent = false;

        while (!sent && retryCount < MAX_RETRIES) {
          try {
            const result = await resend.emails.send({
              from: config.fromName
                ? `${config.fromName} <${config.fromEmail}>`
                : config.fromEmail,
              to: contact.email,
              subject: subject.slice(0, 200),
              html: bodyHtml,
              replyTo: config.replyTo,
            });

            // Create message instance record
            await db.insert(messageInstances).values({
              campaignId,
              contactId: contact.id,
              resendMessageId: result.data?.id ?? null,
              subject: subject.slice(0, 200),
              status: "sent",
              sentAt: new Date(),
            });

            progress.sent++;
            sent = true;
          } catch (err) {
            retryCount++;
            const errorCode = CampaignService.getResendErrorCode(err);
            const isRetryable = CampaignService.isRetryableError(errorCode);

            if (isRetryable && retryCount < MAX_RETRIES) {
              const backoffMs = Math.pow(2, retryCount - 1) * 1000;
              await CampaignService.delay(backoffMs);
            } else {
              await db.insert(messageInstances).values({
                campaignId,
                contactId: contact.id,
                subject: subject.slice(0, 200),
                status: "failed",
              });
              progress.failed++;
              break;
            }
          }
        }
      } catch (llmErr) {
        // LLM generation failed - record as failed
        progress.failed++;
        const llmErrorMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
        await db.insert(messageInstances).values({
          campaignId,
          contactId: contact.id,
          subject: "[LLM Generation Failed]",
          status: "failed",
        });
        // Helper to mask email for logging (e.g., j***@example.com)
        const maskEmail = (email: string | null | undefined): string => {
          if (!email) return "unknown";
          const [local, domain] = email.split("@");
          if (!domain) return "invalid";
          const maskedLocal = local.charAt(0) + "***";
          return `${maskedLocal}@${domain}`;
        };

        console.error("[CampaignService] LLM generation failed for contact", {
          contactId: contact.id,
          emailMasked: maskEmail(contact.email),
          error: llmErrorMsg,
          campaignId,
        });
      }

      onProgress?.(progress);

      // Check complaint rate periodically
      if (progress.sent > 0 && progress.sent % 50 === 0) {
        const shouldPause = await CampaignService.checkComplaintRate(campaignId);
        if (shouldPause) {
          await CampaignService.update(accountId, campaignId, { status: "paused" });
          wasAutoPaused = true;
          break;
        }
      }

      // Throttle for rate limits
      await CampaignService.delay(BATCH_SEND_DELAY_MS);
    }

    // Mark campaign status
    if (!wasAutoPaused) {
      const finalStatus = progress.total > 0 && progress.failed === progress.total ? "stopped" : "completed";
      await CampaignService.update(accountId, campaignId, { status: finalStatus });
      await db
        .update(campaigns)
        .set({ completedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    return progress;
  }

  // === Webhook Processing ===

  /** Process a Resend webhook event */
  static async processWebhookEvent(event: WebhookEvent) {
    const resendMessageId = event.data.email_id;
    if (!resendMessageId) return;

    // Find the corresponding message instance
    const [message] = await db
      .select()
      .from(messageInstances)
      .where(eq(messageInstances.resendMessageId, resendMessageId))
      .limit(1);

    if (!message) return;

    // Record the event
    await db.insert(emailEvents).values({
      messageInstanceId: message.id,
      eventType: event.type,
      timestamp: new Date(event.created_at),
      metadata: event.data as Record<string, unknown>,
    });

    // Update message instance status based on event type (with progression check)
    const statusMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
    };

    // Status precedence: lower = terminal/failure, higher = engagement
    const statusPrecedence: Record<string, number> = {
      "bounced": 0,
      "complained": 0,
      "sent": 1,
      "delivered": 2,
      "opened": 3,
      "clicked": 4,
    };

    const newStatus = statusMap[event.type];
    if (newStatus) {
      const currentStatus = message.status ?? "sent";
      const currentPrecedence = statusPrecedence[currentStatus] ?? 1;
      const newPrecedence = statusPrecedence[newStatus] ?? 1;

      // Only update if new status has equal or higher precedence
      if (newPrecedence >= currentPrecedence) {
        const updateData: Record<string, unknown> = { status: newStatus };

        if (event.type === "email.delivered") {
          // Only set deliveredAt if not already set (prevent regression)
          if (!message.deliveredAt) {
            updateData.deliveredAt = new Date(event.created_at);
          }
        } else if (event.type === "email.opened") {
          // Only set openedAt on first open (preserve earliest)
          if (!message.openedAt) {
            updateData.openedAt = new Date(event.created_at);
          }
          // Always update lastOpenedAt to most recent
          updateData.lastOpenedAt = new Date(event.created_at);
          // Increment open count
          updateData.openCount = (message.openCount ?? 0) + 1;
        }

        await db
          .update(messageInstances)
          .set(updateData)
          .where(eq(messageInstances.id, message.id));
      }
    }

    // Handle unsubscribe — mark contact
    if (event.type === "email.unsubscribed") {
      await db
        .update(contacts)
        .set({ unsubscribed: true })
        .where(eq(contacts.id, message.contactId));
    }
  }

  /** Validate Resend webhook HMAC signature with constant-time comparison */
  static async validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedBytes = new Uint8Array(sig);

    // Decode hex signature to bytes
    const signatureBytes = CampaignService.hexToBytes(signature);
    if (!signatureBytes || signatureBytes.length !== computedBytes.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    let result = 0;
    for (let i = 0; i < computedBytes.length; i++) {
      result |= computedBytes[i] ^ signatureBytes[i];
    }
    return result === 0;
  }

  /** Decode hex string to Uint8Array, return null if invalid */
  private static hexToBytes(hex: string): Uint8Array | null {
    if (hex.length % 2 !== 0) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) return null;
      bytes[i / 2] = byte;
    }
    return bytes;
  }

  // === Helpers ===

  /** Get contacts for a campaign (by group or all) */
  private static async getCampaignContacts(accountId: string, groupId?: string | null) {
    if (groupId) {
      // Import inline to avoid circular dependency
      const { ContactService } = await import("./contact-service.js");
      const { data } = await ContactService.list({
        accountId,
        groupId,
        limit: 100000,
        offset: 0,
      });
      return data;
    }

    // All contacts for account
    return db
      .select()
      .from(contacts)
      .where(eq(contacts.accountId, accountId));
  }

  /** Check if complaint rate exceeds threshold — returns true if campaign should pause */
  private static async checkComplaintRate(campaignId: string): Promise<boolean> {
    // Count all message instances (all attempted sends, regardless of current status)
    const [totalResult] = await db
      .select({ count: count() })
      .from(messageInstances)
      .where(eq(messageInstances.campaignId, campaignId));

    const [complaintResult] = await db
      .select({ count: count() })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.eventType, "email.complained"),
          sql`${emailEvents.messageInstanceId} IN (
            SELECT id FROM message_instances WHERE campaign_id = ${campaignId}
          )`,
        ),
      );

    const totalSent = totalResult?.count ?? 0;
    const complaints = complaintResult?.count ?? 0;

    if (totalSent === 0) return false;
    return complaints / totalSent > COMPLAINT_RATE_THRESHOLD;
  }

  /** Delay utility */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Extract Resend error code from error object */
  private static getResendErrorCode(err: unknown): string | null {
    if (err && typeof err === "object") {
      const error = err as { name?: string; message?: string; code?: string };
      // Check for explicit error code
      if (error.code) return error.code;
      // Check for rate limit in message
      if (error.message?.toLowerCase().includes("rate limit")) return "rate_limit_exceeded";
      // Check for common Resend error names
      if (error.name) return error.name;
    }
    return null;
  }

  /** Determine if a Resend error is retryable */
  private static isRetryableError(errorCode: string | null): boolean {
    if (!errorCode) return false;
    const retryableCodes = [
      "rate_limit_exceeded",
      "internal_server_error",
      "service_unavailable",
      "timeout",
    ];
    return retryableCodes.includes(errorCode.toLowerCase());
  }

  /** Convert plain text to HTML if not already HTML */
  private static convertPlainTextToHtml(text: string): string {
    // Check if already HTML by looking for valid HTML tag patterns
    const trimmed = text.trim();
    // More robust HTML detection: look for complete HTML tag structure
    const hasHtmlTags = /<[^>]+>/.test(trimmed) && /<\/?[a-zA-Z][^>]*>/.test(trimmed);
    
    if (hasHtmlTags) {
      // Sanitize HTML: remove script tags, event handlers, and dangerous attributes
      let sanitized = trimmed;
      
      // Remove script tags and their contents
      sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Remove event handlers (on* attributes)
      sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
      
      // Remove javascript: and data: URLs
      sanitized = sanitized.replace(/(href|src|action)\s*=\s*["']\s*(javascript|data):[^"']*["']/gi, '$1=""');
      
      return sanitized;
    }

    // Escape HTML special characters
    const escaped = trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Split into paragraphs (double newlines) and convert to <p> tags
    const paragraphs = escaped.split(/\n\n+/).filter(p => p.trim());
    
    if (paragraphs.length === 0) {
      return escaped;
    }

    // Convert single newlines to <br> within paragraphs
    const htmlParagraphs = paragraphs.map(p => {
      const withBreaks = p.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    });

    return htmlParagraphs.join('\n');
  }
}
