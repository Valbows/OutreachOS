/**
 * InboxService — IMAP/SMTP integration, reply detection, Gmail labels
 * Phase 5
 */

import {
  db,
  messageInstances,
  contacts,
  replies,
  campaigns
} from "@outreachos/db";
import { eq, and, isNotNull, desc, count } from "drizzle-orm";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls?: boolean;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure?: boolean;
}

export interface ParsedEmail {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: string;
  subject: string;
  bodyPreview: string;
  date: Date;
}

export interface PollResult {
  fetched: number;
  matched: number;
  errors: number;
}

export class InboxService {
  /** Poll inbox for new replies — called by Vercel Cron */
  static async pollForReplies(
    accountId: string,
    config: ImapConfig,
  ): Promise<PollResult> {
    const stats: PollResult = { fetched: 0, matched: 0, errors: 0 };

    try {
      // Fetch recent unseen emails via IMAP
      const emails = await InboxService.fetchUnseenEmails(config);
      stats.fetched = emails.length;

      for (const email of emails) {
        try {
          const match = await InboxService.matchReplyToOutbound(email, accountId);
          if (match) {
            // Process reply in transaction with atomic duplicate handling
            const insertResult = await db.transaction(async (tx) => {
              // Use upsert to handle duplicate detection atomically
              const upsertResult = await tx
                .insert(replies)
                .values({
                  messageInstanceId: match.messageInstanceId,
                  contactId: match.contactId,
                  campaignId: match.campaignId,
                  subject: email.subject,
                  bodyPreview: email.bodyPreview.slice(0, 500),
                  imapMessageId: email.messageId,
                  receivedAt: email.date,
                })
                .onConflictDoNothing({
                  target: [replies.imapMessageId],
                })
                .returning();

              // If no rows returned, this was a duplicate (already processed)
              if (upsertResult.length === 0) {
                return { isNew: false };
              }

              // Update contact replied status (only for new replies)
              await tx
                .update(contacts)
                .set({
                  replied: true,
                  repliedAt: email.date,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(contacts.id, match.contactId),
                    eq(contacts.accountId, accountId),
                  ),
                );

              return { isNew: true };
            });

            if (insertResult.isNew) {
              stats.matched++;
            }
          }
        } catch (err) {
          console.error("Reply processing error:", err);
          stats.errors++;
        }
      }
    } catch (err) {
      console.error("IMAP poll error:", err);
      stats.errors++;
    }

    return stats;
  }

  /** Match an inbound email to an outbound message via In-Reply-To / References headers */
  static async matchReplyToOutbound(
    email: ParsedEmail,
    accountId: string,
  ): Promise<{
    messageInstanceId: string;
    contactId: string;
    campaignId: string;
  } | null> {
    // Check In-Reply-To header first (most reliable)
    if (email.inReplyTo) {
      try {
        const [match] = await db
          .select({
            id: messageInstances.id,
            contactId: messageInstances.contactId,
            campaignId: messageInstances.campaignId,
          })
          .from(messageInstances)
          .innerJoin(campaigns, eq(messageInstances.campaignId, campaigns.id))
          .where(
            and(
              eq(messageInstances.resendMessageId, email.inReplyTo),
              eq(campaigns.accountId, accountId),
            ),
          )
          .limit(1);

        if (match) {
          return {
            messageInstanceId: match.id,
            contactId: match.contactId,
            campaignId: match.campaignId,
          };
        }
      } catch (err) {
        // Log but continue to fallback strategies
        console.error("In-Reply-To lookup failed:", err);
      }
    }

    // Fall back to References header
    if (email.references && email.references.length > 0) {
      for (const ref of email.references) {
        try {
          const [match] = await db
            .select({
              id: messageInstances.id,
              contactId: messageInstances.contactId,
              campaignId: messageInstances.campaignId,
            })
            .from(messageInstances)
            .innerJoin(campaigns, eq(messageInstances.campaignId, campaigns.id))
            .where(
              and(
                eq(messageInstances.resendMessageId, ref),
                eq(campaigns.accountId, accountId),
              ),
            )
            .limit(1);

          if (match) {
            return {
              messageInstanceId: match.id,
              contactId: match.contactId,
              campaignId: match.campaignId,
            };
          }
        } catch (err) {
          // Log but continue to next reference or fallback
          console.error(`References lookup failed for ${ref}:`, err);
        }
      }
    }

    // Fall back to sender email matching
    const fromEmail = InboxService.extractEmail(email.from);
    if (fromEmail) {
      try {
        const [contact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.email, fromEmail),
              eq(contacts.accountId, accountId),
            ),
          )
          .limit(1);

        if (contact) {
          // Find most recent message to this contact
          const [msg] = await db
            .select({
              id: messageInstances.id,
              contactId: messageInstances.contactId,
              campaignId: messageInstances.campaignId,
            })
            .from(messageInstances)
            .innerJoin(campaigns, eq(messageInstances.campaignId, campaigns.id))
            .where(
              and(
                eq(messageInstances.contactId, contact.id),
                eq(campaigns.accountId, accountId),
                isNotNull(messageInstances.sentAt),
              ),
            )
            .orderBy(desc(messageInstances.sentAt))
            .limit(1);

          if (msg) {
            return {
              messageInstanceId: msg.id,
              contactId: msg.contactId,
              campaignId: msg.campaignId,
            };
          }
        }
      } catch (err) {
        // Log sender email matching failure
        console.error("Sender email lookup failed:", err);
      }
    }

    return null;
  }

  /** Fetch unseen emails from IMAP — abstracted for testing */
  static async fetchUnseenEmails(_config: ImapConfig): Promise<ParsedEmail[]> {
    // In production, this uses node-imap to connect and fetch
    // For now, return empty array — actual IMAP implementation
    // requires the node-imap package and runtime Node.js environment
    //
    // Production implementation:
    // 1. Connect to IMAP server with config
    // 2. Open INBOX
    // 3. Search for UNSEEN messages since last poll
    // 4. Fetch headers (Message-ID, In-Reply-To, References, From, Subject, Date)
    // 5. Fetch body preview (first 500 chars)
    // 6. Mark as SEEN
    // 7. Close connection
    console.warn("InboxService.fetchUnseenEmails: IMAP not yet connected — returning empty");
    return [];
  }

  /** Get reply history for a contact */
  static async getReplies(contactId: string) {
    return db
      .select()
      .from(replies)
      .where(eq(replies.contactId, contactId))
      .orderBy(desc(replies.receivedAt));
  }

  /** Get reply count for a campaign */
  static async getCampaignReplyCount(campaignId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(replies)
      .where(eq(replies.campaignId, campaignId));

    return result?.count ?? 0;
  }

  /** Extract email address from a "Name <email>" string */
  private static extractEmail(from: string): string | null {
    const match = from.match(/<([^>]+)>/);
    if (match) return match[1];
    // If no angle brackets, check if it's a bare email
    if (from.includes("@")) return from.trim();
    return null;
  }
}
