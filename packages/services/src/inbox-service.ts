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
import { ImapFlow } from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls?: boolean;
  /** When true (default), TLS will reject invalid/self-signed certificates.
   *  Set to false to allow self-signed certificates (less secure). */
  rejectUnauthorized?: boolean;
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

  /** Fetch unseen emails from IMAP via ImapFlow */
  static async fetchUnseenEmails(config: ImapConfig): Promise<ParsedEmail[]> {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls ?? true,
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: config.rejectUnauthorized ?? true,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      
      try {
        const emails: ParsedEmail[] = [];
        const uids = await client.search({ seen: false });
        
        if (!uids || uids.length === 0) return [];

        for (const uid of uids) {
          try {
            const message = await client.fetchOne(uid.toString(), {
              headers: ["message-id", "in-reply-to", "references", "from", "subject", "date"],
              bodyParts: ["TEXT"],
            });

            if (!message) continue;

            // Handle headers that may be Map, Buffer, or plain object
            const rawHeaders = message.headers;
            let headers: Map<string, string>;
            
            if (rawHeaders instanceof Map) {
              headers = rawHeaders;
            } else if (Buffer.isBuffer(rawHeaders)) {
              // Parse Buffer headers into Map
              headers = InboxService.parseHeadersToMap(rawHeaders.toString());
            } else if (rawHeaders && typeof rawHeaders === 'object') {
              // Convert plain object to Map
              headers = new Map(Object.entries(rawHeaders as Record<string, string>));
            } else {
              // Unexpected type - log warning and use empty Map
              const msgId = (message as { id?: string; uid?: number }).uid || (message as { id?: string; uid?: number }).id || 'unknown';
              console.warn(
                `[InboxService] Unexpected headers type: ${typeof rawHeaders} for message ${msgId}`
              );
              headers = new Map<string, string>();
            }
            const body = message.bodyParts?.get("TEXT")?.toString().slice(0, 500) ?? "";

            emails.push({
              messageId: headers.get("message-id") ?? "",
              inReplyTo: headers.get("in-reply-to"),
              references: (headers.get("references") ?? "").split(/\s+/).filter(Boolean),
              from: headers.get("from") ?? "",
              subject: headers.get("subject") ?? "",
              bodyPreview: body,
              date: InboxService.parseDate(headers.get("date")),
            });
          } catch (msgErr) {
            console.error(`[InboxService] Error fetching message ${uid}:`, msgErr);
          }
        }

        return emails;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /** Parse raw IMAP header block into key-value pairs */
  private static parseHeadersToMap(raw: string): Map<string, string> {
    const headers: Record<string, string> = {};
    const lines = raw.split(/\r?\n/);
    let currentKey = "";
    for (const line of lines) {
      if (/^\s/.test(line) && currentKey) {
        headers[currentKey] += " " + line.trim();
      } else {
        const match = line.match(/^([^:]+):\s*(.*)/);
        if (match) {
          currentKey = match[1].toLowerCase();
          headers[currentKey] = match[2].trim();
        }
      }
    }
    return new Map(Object.entries(headers));
  }

  /** Parse date string with validation, returns current date if invalid */
  private static parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /** Apply a Gmail label to matched reply messages (via IMAP COPY) */
  static async applyGmailLabel(
    config: ImapConfig,
    messageIds: string[],
    labelName: string = "leads",
  ): Promise<number> {
    if (messageIds.length === 0) return 0;

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls ?? true,
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: config.rejectUnauthorized ?? true,
      },
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      
      try {
        let labeled = 0;
        // Gmail exposes labels as IMAP folders
        const gmailLabel = `[Gmail]/${labelName}`;

        for (const mid of messageIds) {
          try {
            // Search for message by Message-ID header
            const seqs = await client.search({ header: { "message-id": mid } });
            if (!seqs || seqs.length === 0) continue;
            
            // Fetch to get UID (more stable than sequence numbers)
            const seq = seqs[0];
            const msg = await client.fetchOne(seq.toString(), { uid: true });
            if (!msg || typeof msg !== 'object') continue;
            
            // Access uid through type assertion (ImapFlow doesn't expose it in types)
            const uid = (msg as { uid?: number }).uid;
            if (!uid) continue;
            
            try {
              await client.messageCopy(uid.toString(), gmailLabel, { uid: true });
              labeled++;
            } catch (copyErr) {
              console.error(`[InboxService] Failed to label message ${mid}:`, copyErr);
            }
          } catch (fetchErr) {
            console.error(`[InboxService] Failed to fetch message ${mid}:`, fetchErr);
          }
        }

        return labeled;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /** Copy matched messages to a destination folder (non-Gmail IMAP) */
  static async copyToFolder(
    config: ImapConfig,
    messageIds: string[],
    destinationFolder: string,
  ): Promise<number> {
    if (messageIds.length === 0) return 0;

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls ?? true,
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: config.rejectUnauthorized ?? true,
      },
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      
      try {
        let copied = 0;

        for (const mid of messageIds) {
          try {
            // Search for message by Message-ID header
            const seqs = await client.search({ header: { "message-id": mid } });
            if (!seqs || seqs.length === 0) continue;
            
            // Fetch to get UID (more stable than sequence numbers)
            const seq = seqs[0];
            const msg = await client.fetchOne(seq.toString(), { uid: true });
            if (!msg || typeof msg !== 'object') continue;
            
            // Access uid through type assertion (ImapFlow doesn't expose it in types)
            const uid = (msg as { uid?: number }).uid;
            if (!uid) continue;
            
            try {
              await client.messageCopy(uid.toString(), destinationFolder, { uid: true });
              copied++;
            } catch (copyErr) {
              console.error(`[InboxService] Failed to copy message ${mid}:`, copyErr);
            }
          } catch (fetchErr) {
            console.error(`[InboxService] Failed to fetch message ${mid}:`, fetchErr);
          }
        }

        return copied;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /**
   * Full poll workflow: fetch → match → persist → label/copy.
   * Called by the Vercel Cron endpoint every 5 minutes.
   */
  static async pollAndProcess(
    accountId: string,
    config: ImapConfig,
    options?: {
      gmailLabel?: string;
      destinationFolder?: string;
      isGmail?: boolean;
    },
  ): Promise<PollResult & { labeled: number }> {
    const result = await InboxService.pollForReplies(accountId, config);
    let labeled = 0;

    // Collect matched message IDs for labeling/copying
    if (result.matched > 0 && options) {
      const recentReplies = await db
        .select({ imapMessageId: replies.imapMessageId })
        .from(replies)
        .innerJoin(campaigns, eq(replies.campaignId, campaigns.id))
        .where(eq(campaigns.accountId, accountId))
        .orderBy(desc(replies.createdAt))
        .limit(result.matched);

      const messageIds = recentReplies
        .map((r) => r.imapMessageId)
        .filter((id): id is string => id !== null);

      if (messageIds.length > 0) {
        try {
          if (options.isGmail && options.gmailLabel) {
            labeled = await InboxService.applyGmailLabel(config, messageIds, options.gmailLabel);
          } else if (options.destinationFolder) {
            labeled = await InboxService.copyToFolder(config, messageIds, options.destinationFolder);
          }
        } catch (err) {
          console.error("[InboxService] Label/copy error:", err);
        }
      }
    }

    return { ...result, labeled };
  }

  /** Update response rate for a campaign based on reply count */
  static async getResponseRate(campaignId: string): Promise<number> {
    const [[replyResult], [sentResult]] = await Promise.all([
      db.select({ count: count() }).from(replies).where(eq(replies.campaignId, campaignId)),
      db.select({ count: count() }).from(messageInstances).where(
        and(eq(messageInstances.campaignId, campaignId), isNotNull(messageInstances.sentAt)),
      ),
    ]);
    const replyCount = replyResult?.count ?? 0;
    const sentCount = sentResult?.count ?? 0;
    return sentCount > 0 ? replyCount / sentCount : 0;
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
  static extractEmail(from: string): string | null {
    const match = from.match(/<([^>]+)>/);
    if (match) return match[1];
    // If no angle brackets, check if it's a bare email
    if (from.includes("@")) return from.trim();
    return null;
  }

  /** Create a Nodemailer SMTP transporter from config */
  static createSmtpTransporter(config: SmtpConfig): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  /** Verify SMTP connection works (auth + DNS + TLS) */
  static async verifySmtpConnection(config: SmtpConfig): Promise<boolean> {
    const transporter = InboxService.createSmtpTransporter(config);
    try {
      await transporter.verify();
      return true;
    } catch (err) {
      console.error("[InboxService] SMTP verify failed:", err);
      return false;
    } finally {
      transporter.close();
    }
  }

  /**
   * Send an email via SMTP (used as fallback when Resend is unavailable,
   * or for user's own-inbox replies where they want to keep sending
   * from their personal domain).
   */
  static async sendViaSmtp(
    config: SmtpConfig,
    options: {
      from: string;
      to: string;
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
      inReplyTo?: string;
      references?: string[];
      headers?: Record<string, string>;
    },
  ): Promise<{ messageId: string; accepted: string[]; rejected: string[] }> {
    if (!options.html && !options.text) {
      throw new Error("Either html or text body is required");
    }

    const transporter = InboxService.createSmtpTransporter(config);

    try {
      const info = await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        inReplyTo: options.inReplyTo,
        references: options.references?.join(" "),
        headers: options.headers,
      });

      return {
        messageId: info.messageId || "",
        accepted: (info.accepted || []).map((a: string | { address: string }) =>
          typeof a === "string" ? a : a.address
        ),
        rejected: (info.rejected || []).map((r: string | { address: string }) =>
          typeof r === "string" ? r : r.address
        ),
      };
    } finally {
      transporter.close();
    }
  }
}
