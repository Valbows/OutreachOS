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
  blogPosts,
} from "@outreachos/db";
import { eq, and, desc, sql, count, isNotNull } from "drizzle-orm";
import { Resend } from "resend";
import { TemplateService, type RenderContext } from "./template-service.js";

const NEWSLETTER_GROUP_NAME = "newsletter_subscriber";
const BATCH_SEND_DELAY_MS = 100;

/** Escape user-supplied strings before interpolating them into HTML to prevent XSS. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Add months to a date, clamping to the last day of the target month on overflow (e.g. Jan 31 → Feb 28). */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // If setMonth overflowed (e.g. Jan 31 + 1 month → Mar 2), roll back to last day of intended month
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // day 0 of current month = last day of previous month
  }
  return result;
}

export interface CreateNewsletterInput {
  accountId: string;
  name: string;
  templateId: string;
  scheduledAt?: Date;
  recurrence?: "none" | "weekly" | "monthly";
  settings?: Record<string, unknown>;
  /** Number of latest blog posts to include (0 = none) */
  embedBlogPosts?: number;
}

export interface NewsletterSendConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  /** Optional base URL for blog links in rich newsletters */
  blogBaseUrl?: string;
}

export interface NewsletterSendResult {
  sent: number;
  failed: number;
  total: number;
}

export class NewsletterService {
  /** Create a newsletter campaign */
  static async create(input: CreateNewsletterInput) {
    const settings: Record<string, unknown> = {
      ...(input.settings ?? {}),
    };

    // Store blog embed setting in settings if provided
    if (input.embedBlogPosts !== undefined) {
      settings.embedBlogPosts = input.embedBlogPosts;
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        accountId: input.accountId,
        name: input.name,
        type: "newsletter",
        status: "draft",
        templateId: input.templateId,
        scheduledAt: input.scheduledAt ?? null,
        recurrence: input.recurrence ?? "none",
        settings,
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

        let subjectRendered = "";
        try {
          // Render template with contact context (inside try to catch rendering failures locally)
          const context: RenderContext = {
            firstName: subscriber.firstName ?? "",
            lastName: subscriber.lastName ?? "",
            companyName: "",
            businessWebsite: "",
            city: "",
            state: "",
          };

          // Determine if using rich layout rendering
          const isRichTemplate =
            (template.templateType as string) === "rich" ||
            (template.templateType as string) === "newsletter";

          // Get embed settings from campaign
          const campaignSettings = (campaign.settings ?? {}) as Record<string, unknown>;
          const embedBlogPosts = campaignSettings.embedBlogPosts as number | undefined;

          let subjectRendered: string;
          let htmlRendered: string;

          if (isRichTemplate) {
            // Use rich newsletter rendering with blog embedding
            const richResult = await NewsletterService.renderRichNewsletter(
              accountId,
              {
                id: template.id,
                name: template.name,
                subject: template.subject ?? "Newsletter",
                bodyHtml: template.bodyHtml,
                templateType: template.templateType as string,
                tokenFallbacks: template.tokenFallbacks as Record<string, string> | null,
              },
              context,
              {
                embedBlogPosts,
                blogBaseUrl: sendConfig.blogBaseUrl,
              },
            );
            subjectRendered = richResult.subject;
            htmlRendered = richResult.html;
          } else {
            // Use simple template rendering
            subjectRendered = TemplateService.renderSubject(
              template.subject ?? "Newsletter",
              context,
              (template.tokenFallbacks as Record<string, string>) ?? {},
            );
            htmlRendered = TemplateService.render(
              template.bodyHtml ?? "",
              context,
              (template.tokenFallbacks as Record<string, string>) ?? {},
            );
          }

          const result = await resend.emails.send({
            from: sendConfig.fromName
              ? `${sendConfig.fromName} <${sendConfig.fromEmail}>`
              : sendConfig.fromEmail,
            to: subscriber.email,
            subject: subjectRendered,
            html: htmlRendered,
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

      // Mark campaign as completed and record last sent time for recurrence
      await db
        .update(campaigns)
        .set({
          status: "completed",
          completedAt: new Date(),
          lastSentAt: new Date(),
          updatedAt: new Date(),
          progress: { sentCount: sent, failedCount: failed },
        })
        .where(eq(campaigns.id, campaignId));

      return { sent, failed, total };
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

  /** Get newsletters due to be sent (for cron worker) - includes scheduled and recurring */
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

  /** Get latest blog posts for newsletter embedding */
  static async getLatestBlogPosts(
    accountId: string,
    limit = 3,
  ): Promise<
    Array<{
      id: string;
      title: string;
      slug: string;
      excerpt: string;
      publishedAt: Date;
    }>
  > {
    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        content: blogPosts.content,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.accountId, accountId),
          isNotNull(blogPosts.publishedAt),
        ),
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit);

    return posts.map((post) => ({
      id: post.id,
      title: escapeHtml(post.title),
      slug: escapeHtml(post.slug),
      excerpt: escapeHtml(post.content.slice(0, 200).replace(/[#*`_]/g, "")) + "...",
      publishedAt: post.publishedAt!,
    }));
  }

  /** Render a rich newsletter layout with headers, sections, blog embeds */
  static async renderRichNewsletter(
    accountId: string,
    template: {
      id: string;
      name: string;
      subject: string | null;
      bodyHtml: string | null;
      templateType: string;
      tokenFallbacks: Record<string, string> | null;
    },
    contactContext: RenderContext,
    options?: {
      embedBlogPosts?: number;
      blogBaseUrl?: string;
    },
  ): Promise<{ subject: string; html: string }> {
    // Render subject
    const subject = TemplateService.renderSubject(
      template.subject ?? "Newsletter",
      contactContext,
      template.tokenFallbacks ?? {},
    );

    // Get blog posts if embedding enabled
    let blogSection = "";
    if (options?.embedBlogPosts && options.embedBlogPosts > 0) {
      const posts = await NewsletterService.getLatestBlogPosts(accountId, options.embedBlogPosts);
      if (posts.length > 0) {
        const baseUrl = options.blogBaseUrl ?? `https://${accountId}.outreachos.com`;
        blogSection = `
<div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
  <h2 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 18px;">Latest from our blog</h2>
  ${posts
    .map(
      (post) => `
    <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 8px 0; font-size: 16px;">
        <a href="${baseUrl}/blog/${post.slug}" style="color: #4f46e5; text-decoration: none;">${post.title}</a>
      </h3>
      <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">${post.excerpt}</p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
        ${post.publishedAt.toLocaleDateString()}
      </p>
    </div>
  `,
    )
    .join("")}
</div>`;
      }
    }

    // Render body with rich layout wrapper
    const bodyContent = template.bodyHtml ?? "";
    const renderedBody = TemplateService.render(
      bodyContent,
      contactContext,
      template.tokenFallbacks ?? {},
    );

    // Wrap in rich newsletter layout
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px;">
              <div style="color: #1a1a2e; font-size: 16px; line-height: 1.6;">
                ${renderedBody}
              </div>
              ${blogSection}
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                <p>You received this because you're subscribed to our newsletter.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject, html };
  }

  /** Setup recurring schedule for a newsletter */
  static async setupRecurringSchedule(
    accountId: string,
    campaignId: string,
    recurrence: "none" | "weekly" | "monthly",
    nextSendAt?: Date,
  ) {
    // Verify campaign exists and is a newsletter
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

    // Calculate next scheduled time if not provided
    let scheduledAt = nextSendAt;
    if (!scheduledAt && recurrence !== "none") {
      scheduledAt = new Date();
      if (recurrence === "weekly") {
        scheduledAt.setDate(scheduledAt.getDate() + 7);
      } else if (recurrence === "monthly") {
        scheduledAt = addMonths(scheduledAt, 1);
      }
    }

    // Update campaign with recurrence settings
    const [updated] = await db
      .update(campaigns)
      .set({
        recurrence,
        scheduledAt: recurrence === "none" ? null : scheduledAt,
        status: recurrence === "none" ? "draft" : "draft", // Keep as draft until scheduled
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

  /** Process recurring newsletters - called by cron job after a send completes */
  static async processRecurringNewsletters() {
    // Find newsletters that were just sent and have recurrence enabled
    const completedNewsletters = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.type, "newsletter"),
          eq(campaigns.status, "completed"),
          sql`${campaigns.recurrence} != 'none'`,
          sql`${campaigns.lastSentAt} IS NOT NULL`,
        ),
      );

    const results = [];

    for (const newsletter of completedNewsletters) {
      try {
        // Calculate next send time based on recurrence
        const lastSent = newsletter.lastSentAt ?? new Date();
        const nextSend = new Date(lastSent);

        if (newsletter.recurrence === "weekly") {
          nextSend.setDate(nextSend.getDate() + 7);
        } else if (newsletter.recurrence === "monthly") {
          const advanced = addMonths(nextSend, 1);
          nextSend.setTime(advanced.getTime());
        } else {
          continue;
        }

        // Clone the newsletter for next occurrence
        const [newCampaign] = await db
          .insert(campaigns)
          .values({
            accountId: newsletter.accountId,
            name: newsletter.name,
            type: "newsletter",
            status: "draft",
            templateId: newsletter.templateId,
            scheduledAt: nextSend,
            recurrence: newsletter.recurrence,
            settings: {
              ...(newsletter.settings ?? {}),
              parentCampaignId: newsletter.id,
              autoScheduled: true,
            },
          })
          .returning();

        results.push({
          originalCampaignId: newsletter.id,
          newCampaignId: newCampaign.id,
          nextSendAt: nextSend,
        });
      } catch (err) {
        console.error(`Failed to process recurring newsletter ${newsletter.id}:`, err);
        results.push({
          originalCampaignId: newsletter.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }
}
