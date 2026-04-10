/**
 * NewsletterService — Newsletter send flow, subscriber segmentation, scheduling
 * Phase 5.8
 */

import {
  db,
  campaigns,
  contacts,
  messageInstances,
  templates,
} from "@outreachos/db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { Resend } from "resend";
import { TemplateService, type RenderContext } from "./template-service.js";

const NEWSLETTER_GROUP_NAME = "newsletter_subscriber";
const BATCH_SEND_DELAY_MS = 100;

export interface CreateNewsletterInput {
  accountId: string;
  name: string;
  templateId: string;
  scheduledAt?: Date;
  settings?: Record<string, unknown>;
}

export interface NewsletterSendConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export interface NewsletterSendResult {
  sent: number;
  failed: number;
  total: number;
}

export class NewsletterService {
  /** Create a newsletter campaign */
  static async create(input: CreateNewsletterInput) {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        accountId: input.accountId,
        name: input.name,
        type: "newsletter",
        status: "draft",
        templateId: input.templateId,
        scheduledAt: input.scheduledAt ?? null,
        settings: input.settings ?? null,
      })
      .returning();

    return campaign;
  }

  /** List newsletter campaigns */
  static async list(accountId: string) {
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "newsletter"),
        ),
      )
      .orderBy(desc(campaigns.createdAt));
  }

  /** Get newsletter subscribers — contacts tagged with "newsletter_subscriber" group
   * @param lastProcessedContactId - Optional ID to resume from (excludes contacts with ID <= this value)
   */
  static async getSubscribers(
    accountId: string,
    lastProcessedContactId?: string,
  ): Promise<Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null }>> {
    // Build base conditions
    const baseConditions = [
      eq(contacts.accountId, accountId),
      eq(contacts.unsubscribed, false),
      sql`${contacts.id} IN (
        SELECT cgm.contact_id FROM contact_group_members cgm
        JOIN contact_groups cg ON cg.id = cgm.group_id
        WHERE cg.name = ${NEWSLETTER_GROUP_NAME}
        AND cg.account_id = ${accountId}
      )`,
    ];

    // Add resume filter if provided (database-level filtering for efficiency)
    if (lastProcessedContactId) {
      baseConditions.push(sql`${contacts.id} > ${lastProcessedContactId}`);
    }

    // Query contacts that belong to the newsletter_subscriber group
    const subscribers = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(contacts)
      .where(and(...baseConditions))
      .orderBy(contacts.id); // Ensure deterministic ordering for resume logic

    return subscribers;
  }

  /** Send newsletter to all subscribers */
  static async send(
    accountId: string,
    campaignId: string,
    sendConfig: NewsletterSendConfig,
  ): Promise<NewsletterSendResult> {
    // Verify campaign exists and is a newsletter
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "newsletter"),
        ),
      )
      .limit(1);

    if (!campaign) throw new Error("Newsletter campaign not found");
    if (campaign.status !== "draft") {
      throw new Error(`Newsletter campaign not in draft state (current: ${campaign.status})`);
    }
    if (!campaign.templateId) throw new Error("Newsletter has no template assigned");

    // Get template
    const template = await TemplateService.getById(accountId, campaign.templateId);
    if (!template) throw new Error("Template not found");

    // Check for existing progress to resume from where it left off
    const existingProgress = (campaign.progress ?? {}) as Record<string, unknown>;
    const lastProcessedId = existingProgress.lastProcessedContactId as string | undefined;
    const existingSent = (existingProgress.sentCount as number) ?? 0;
    const existingFailed = (existingProgress.failedCount as number) ?? 0;
    const existingTotal = (existingProgress.total as number) ?? undefined;

    // Get subscribers (with database-level filtering if resuming)
    const subscribers = await NewsletterService.getSubscribers(accountId, lastProcessedId);
    if (subscribers.length === 0) {
      // Return accumulated progress from previous runs
      return { sent: existingSent, failed: existingFailed, total: existingTotal ?? existingSent + existingFailed };
    }

    // Mark campaign as active
    await db
      .update(campaigns)
      .set({ status: "active", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    const resend = new Resend(sendConfig.resendApiKey);
    let sent = existingSent;
    let failed = existingFailed;
    // Compute total as original campaign size (existing + remaining), not just remaining
    const total = existingTotal ?? sent + failed + subscribers.length;

    // Helper to update progress atomically
    const updateProgress = async (contactId: string) => {
      await db
        .update(campaigns)
        .set({
          progress: {
            lastProcessedContactId: contactId,
            sentCount: sent,
            failedCount: failed,
          },
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    };

    try {
      for (const subscriber of subscribers) {
        if (!subscriber.email) {
          failed++;
          await db.insert(messageInstances).values({
            campaignId,
            contactId: subscriber.id,
            templateId: template.id,
            subject: "",
            status: "failed",
          });
          await updateProgress(subscriber.id);
          continue;
        }

        try {
          // Render template with contact context (inside try to catch rendering failures locally)
          const context: RenderContext = {
            FirstName: subscriber.firstName ?? "",
            LastName: subscriber.lastName ?? "",
            CompanyName: "",
            BusinessWebsite: "",
            City: "",
            State: "",
          };

          const rendered = TemplateService.render(
            template.bodyHtml ?? "",
            context,
            (template.tokenFallbacks as Record<string, string>) ?? {},
          );

          const subjectRendered = TemplateService.renderSubject(
            template.subject ?? "Newsletter",
            context,
            (template.tokenFallbacks as Record<string, string>) ?? {},
          );

          const result = await resend.emails.send({
            from: sendConfig.fromName
              ? `${sendConfig.fromName} <${sendConfig.fromEmail}>`
              : sendConfig.fromEmail,
            to: subscriber.email,
            subject: subjectRendered,
            html: rendered,
            replyTo: sendConfig.replyTo,
          });

          if (result.error || !result.data?.id) {
            failed++;
            await db.insert(messageInstances).values({
              campaignId,
              contactId: subscriber.id,
              templateId: template.id,
              subject: subjectRendered,
              status: "failed",
            });
          } else {
            sent++;
            await db.insert(messageInstances).values({
              campaignId,
              contactId: subscriber.id,
              templateId: template.id,
              resendMessageId: result.data.id,
              subject: subjectRendered,
              status: "sent",
              sentAt: new Date(),
            });
          }

          // Rate limiting
          if (BATCH_SEND_DELAY_MS > 0) {
            await new Promise((r) => setTimeout(r, BATCH_SEND_DELAY_MS));
          }
        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[NewsletterService] Failed to send to subscriber ${subscriber.id}:`, errorMsg);
          // Create audit record for failed send
          await db.insert(messageInstances).values({
            campaignId,
            contactId: subscriber.id,
            templateId: template.id,
            subject: subjectRendered,
            status: "failed",
          });
          // Continue with next subscriber
        }

        // Update progress after each contact (for crash recovery)
        await updateProgress(subscriber.id);
      }

      // Mark campaign as completed
      await db
        .update(campaigns)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          progress: { sentCount: sent, failedCount: failed },
        })
        .where(eq(campaigns.id, campaignId));

      return { sent, failed, total: subscribers.length };
    } catch (err) {
      // On unexpected error, mark campaign as failed instead of leaving it active
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[NewsletterService] Fatal error during newsletter send:", errorMsg);

      await db
        .update(campaigns)
        .set({
          status: "stopped",
          updatedAt: new Date(),
          settings: {
            ...((campaign.settings ?? {}) as Record<string, unknown>),
            error: errorMsg,
          },
        })
        .where(eq(campaigns.id, campaignId));

      throw err;
    }
  }

  /** Schedule a newsletter for future send */
  static async schedule(
    accountId: string,
    campaignId: string,
    scheduledAt: Date,
  ) {
    // Validate scheduledAt is in the future
    if (scheduledAt <= new Date()) {
      throw new Error("scheduledAt must be in the future");
    }

    // Verify campaign exists and fetch current status
    const [campaign] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "newsletter"),
        ),
      )
      .limit(1);

    if (!campaign) {
      throw new Error("Newsletter campaign not found");
    }

    // Disallow rescheduling active or completed campaigns
    if (campaign.status === "active" || campaign.status === "completed") {
      throw new Error(`Cannot reschedule newsletter with status "${campaign.status}"`);
    }

    // Update and return the campaign
    const [updated] = await db
      .update(campaigns)
      .set({
        scheduledAt,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "newsletter"),
        ),
      )
      .returning();

    return updated;
  }

  /** Get newsletters due to be sent (for cron worker) */
  static async getDueNewsletters() {
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.type, "newsletter"),
          eq(campaigns.status, "draft"),
          sql`${campaigns.scheduledAt} IS NOT NULL AND ${campaigns.scheduledAt} <= NOW()`,
        ),
      );
  }
}
