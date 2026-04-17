import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@outreachos/db";
import { ImapFlow } from "imapflow";
import { InboxService, type ImapConfig, type ParsedEmail } from "./inbox-service.js";

// Mock the database
vi.mock("@outreachos/db", () => ({
  db: {
    transaction: vi.fn((fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ 
          onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "reply-1" }]) }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "contact-1" }]),
            orderBy: vi.fn().mockResolvedValue([{ id: "msg-1", contactId: "contact-1", campaignId: "camp-1" }]),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "reply-1" }]),
              orderBy: vi.fn().mockResolvedValue([{ imapMessageId: "msg-123" }]),
            }),
          }),
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "reply-1" }]) }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "msg-1", contactId: "contact-1", campaignId: "camp-1" }]),
              orderBy: vi.fn().mockResolvedValue([{ imapMessageId: "msg-123" }]),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  messageInstances: { id: vi.fn(), campaignId: vi.fn(), contactId: vi.fn(), resendMessageId: vi.fn(), sentAt: vi.fn() },
  contacts: { id: vi.fn(), accountId: vi.fn(), email: vi.fn(), replied: vi.fn(), repliedAt: vi.fn(), updatedAt: vi.fn() },
  replies: { id: vi.fn(), contactId: vi.fn(), campaignId: vi.fn(), imapMessageId: vi.fn(), createdAt: vi.fn(), receivedAt: vi.fn() },
  campaigns: { id: vi.fn(), accountId: vi.fn() },
  eq: vi.fn((a, b) => ({ column: a, value: b })),
  and: vi.fn((...conds) => ({ op: "AND", conds })),
  desc: vi.fn((col) => ({ column: col, direction: "DESC" })),
  isNotNull: vi.fn((col) => ({ column: col, op: "IS NOT NULL" })),
  count: vi.fn(() => ({ fn: "COUNT" })),
}));

// Mock ImapFlow
vi.mock("imapflow", () => ({
  ImapFlow: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
    search: vi.fn().mockResolvedValue([]),
    fetchOne: vi.fn().mockResolvedValue(null),
    messageCopy: vi.fn().mockResolvedValue(undefined),
  })),
}));

const baseConfig: ImapConfig = {
  host: "imap.example.com",
  port: 993,
  user: "user@example.com",
  password: "password",
};

function createImapClient() {
  const release = vi.fn();
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    release,
    getMailboxLock: vi.fn().mockResolvedValue({ release }),
    search: vi.fn().mockResolvedValue([]),
    fetchOne: vi.fn().mockResolvedValue(null),
    messageCopy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("InboxService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("class structure", () => {
    it("exports InboxService with expected methods", () => {
      expect(InboxService).toBeDefined();
      expect(typeof InboxService.pollForReplies).toBe("function");
      expect(typeof InboxService.matchReplyToOutbound).toBe("function");
      expect(typeof InboxService.fetchUnseenEmails).toBe("function");
      expect(typeof InboxService.applyGmailLabel).toBe("function");
      expect(typeof InboxService.copyToFolder).toBe("function");
      expect(typeof InboxService.pollAndProcess).toBe("function");
      expect(typeof InboxService.getResponseRate).toBe("function");
      expect(typeof InboxService.getReplies).toBe("function");
      expect(typeof InboxService.getCampaignReplyCount).toBe("function");
    });
  });

  describe("fetchUnseenEmails", () => {
    it("fetches unseen emails from IMAP and parses them into parsed emails", async () => {
      const client = createImapClient();
      client.search.mockResolvedValue([101]);
      client.fetchOne.mockResolvedValue({
        headers: new Map([
          ["message-id", "<msg-123@example.com>"],
          ["in-reply-to", "<original-msg@example.com>"],
          ["references", "<original-msg@example.com> <thread-root@example.com>"],
          ["from", "John Doe <john@example.com>"],
          ["subject", "Re: Meeting tomorrow"],
          ["date", "2024-01-15T10:30:00.000Z"],
        ]),
        bodyParts: new Map([["TEXT", Buffer.from("Thanks for the invite...")]]),
      });
      vi.mocked(ImapFlow).mockImplementationOnce(() => client as never);

      const emails = await InboxService.fetchUnseenEmails({
        ...baseConfig,
        tls: false,
        rejectUnauthorized: false,
      });

      expect(ImapFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          host: baseConfig.host,
          port: baseConfig.port,
          secure: false,
          auth: { user: baseConfig.user, pass: baseConfig.password },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
        }),
      );
      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.getMailboxLock).toHaveBeenCalledWith("INBOX");
      expect(client.search).toHaveBeenCalledWith({ seen: false });
      expect(client.fetchOne).toHaveBeenCalledWith("101", {
        headers: ["message-id", "in-reply-to", "references", "from", "subject", "date"],
        bodyParts: ["TEXT"],
      });
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(client.logout).toHaveBeenCalledTimes(1);
      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({
        messageId: "<msg-123@example.com>",
        inReplyTo: "<original-msg@example.com>",
        references: ["<original-msg@example.com>", "<thread-root@example.com>"],
        from: "John Doe <john@example.com>",
        subject: "Re: Meeting tomorrow",
        bodyPreview: "Thanks for the invite...",
      });
      expect(emails[0]?.date.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  describe("pollForReplies", () => {
    it("fetches, matches, and persists replies while updating poll stats", async () => {
      const email: ParsedEmail = {
        messageId: "<reply-123@example.com>",
        from: "Known Contact <known@example.com>",
        subject: "Re: Hello",
        bodyPreview: "Hi there...",
        date: new Date("2024-01-15T10:30:00.000Z"),
      };
      const returning = vi.fn().mockResolvedValue([{ id: "reply-1" }]);
      const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
      const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
      const txInsert = vi.fn().mockReturnValue({ values: insertValues });
      const updateWhere = vi.fn().mockResolvedValue(undefined);
      const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
      const txUpdate = vi.fn().mockReturnValue({ set: updateSet });

      vi.spyOn(InboxService, "fetchUnseenEmails").mockResolvedValue([email]);
      vi.spyOn(InboxService, "matchReplyToOutbound").mockResolvedValue({
        messageInstanceId: "msg-1",
        contactId: "contact-1",
        campaignId: "camp-1",
      });
      vi.mocked(db.transaction).mockImplementationOnce(
        ((fn: (tx: unknown) => unknown) =>
          fn({
            insert: txInsert,
            update: txUpdate,
          })) as never,
      );

      const result = await InboxService.pollForReplies("account-1", baseConfig);

      expect(result).toEqual({ fetched: 1, matched: 1, errors: 0 });
      expect(InboxService.fetchUnseenEmails).toHaveBeenCalledWith(baseConfig);
      expect(InboxService.matchReplyToOutbound).toHaveBeenCalledWith(email, "account-1");
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(txInsert).toHaveBeenCalledTimes(1);
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          messageInstanceId: "msg-1",
          contactId: "contact-1",
          campaignId: "camp-1",
          subject: email.subject,
          bodyPreview: email.bodyPreview,
          imapMessageId: email.messageId,
          receivedAt: email.date,
        }),
      );
      expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
      expect(txUpdate).toHaveBeenCalledTimes(1);
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          replied: true,
          repliedAt: email.date,
          updatedAt: expect.any(Date),
        }),
      );
      expect(updateWhere).toHaveBeenCalledTimes(1);
    });
  });

  describe("reply matching strategies", () => {
    const accountId = "account-1";

    const makeHeaderMatchChain = (result: { id: string; contactId: string; campaignId: string } | null) => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(result ? [result] : []),
          }),
        }),
      }),
    });

    const makeContactLookupChain = (result: { id: string } | null) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result ? [result] : []),
        }),
      }),
    });

    const makeRecentMessageChain = (result: { id: string; contactId: string; campaignId: string } | null) => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result ? [result] : []),
            }),
          }),
        }),
      }),
    });

    beforeEach(() => {
      vi.mocked(db.select).mockClear();
    });

    it("prioritizes In-Reply-To header matching", async () => {
      // In-Reply-To is the most reliable matching strategy
      const emailWithReplyTo: ParsedEmail = {
        messageId: "<reply-123@example.com>",
        inReplyTo: "<original-456@resend.com>",
        from: "contact@example.com",
        subject: "Re: Your message",
        bodyPreview: "Thanks for reaching out...",
        date: new Date(),
      };

      vi.mocked(db.select).mockReturnValueOnce(
        makeHeaderMatchChain({
          id: "msg-1",
          contactId: "contact-1",
          campaignId: "camp-1",
        }) as never,
      );

      const result = await InboxService.matchReplyToOutbound(emailWithReplyTo, accountId);

      expect(result).toEqual({
        messageInstanceId: "msg-1",
        contactId: "contact-1",
        campaignId: "camp-1",
      });
    });

    it("falls back to References header when In-Reply-To missing", async () => {
      const emailWithReferences: ParsedEmail = {
        messageId: "<reply-789@example.com>",
        references: ["<original-abc@resend.com>", "<other@example.com>"],
        from: "contact@example.com",
        subject: "Re: Your message",
        bodyPreview: "Following up...",
        date: new Date(),
      };

      vi.mocked(db.select).mockReturnValueOnce(
        makeHeaderMatchChain({
          id: "msg-2",
          contactId: "contact-2",
          campaignId: "camp-2",
        }) as never,
      );

      const result = await InboxService.matchReplyToOutbound(emailWithReferences, accountId);

      expect(result).toEqual({
        messageInstanceId: "msg-2",
        contactId: "contact-2",
        campaignId: "camp-2",
      });
    });

    it("falls back to sender email matching as last resort", async () => {
      const emailFromKnownContact: ParsedEmail = {
        messageId: "<reply-xyz@example.com>",
        from: "Known Contact <known@example.com>",
        subject: "Quick question",
        bodyPreview: "Hi, I have a question...",
        date: new Date(),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce(makeContactLookupChain({ id: "contact-3" }) as never)
        .mockReturnValueOnce(
          makeRecentMessageChain({
            id: "msg-3",
            contactId: "contact-3",
            campaignId: "camp-3",
          }) as never,
        );

      const result = await InboxService.matchReplyToOutbound(emailFromKnownContact, accountId);

      expect(result).toEqual({
        messageInstanceId: "msg-3",
        contactId: "contact-3",
        campaignId: "camp-3",
      });
    });
  });

  describe("email extraction", () => {
    it("extracts email from Name <email> format", () => {
      expect(InboxService.extractEmail("John Doe <john@example.com>")).toBe("john@example.com");
    });

    it("handles bare email addresses", () => {
      expect(InboxService.extractEmail("jane@example.com")).toBe("jane@example.com");
    });
  });

  describe("applyGmailLabel", () => {
    it("copies matched messages to the requested Gmail label", async () => {
      const client = createImapClient();
      client.search.mockResolvedValue([7]);
      client.fetchOne.mockResolvedValue({ uid: 99 });
      vi.mocked(ImapFlow).mockImplementationOnce(() => client as never);

      const result = await InboxService.applyGmailLabel(
        baseConfig,
        ["<msg-123@example.com>"],
        "Prospects/Qualified",
      );

      expect(result).toBe(1);
      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.getMailboxLock).toHaveBeenCalledWith("INBOX");
      expect(client.search).toHaveBeenCalledWith({ header: { "message-id": "<msg-123@example.com>" } });
      expect(client.fetchOne).toHaveBeenCalledWith("7", { uid: true });
      expect(client.messageCopy).toHaveBeenCalledWith("99", "[Gmail]/Prospects/Qualified", { uid: true });
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(client.logout).toHaveBeenCalledTimes(1);
    });
  });

  describe("copyToFolder", () => {
    it("copies matched messages to a destination folder", async () => {
      const client = createImapClient();
      client.search.mockResolvedValue([11]);
      client.fetchOne.mockResolvedValue({ uid: 42 });
      vi.mocked(ImapFlow).mockImplementationOnce(() => client as never);

      const result = await InboxService.copyToFolder(baseConfig, ["<msg-456@example.com>"], "Processed");

      expect(result).toBe(1);
      expect(client.connect).toHaveBeenCalledTimes(1);
      expect(client.getMailboxLock).toHaveBeenCalledWith("INBOX");
      expect(client.search).toHaveBeenCalledWith({ header: { "message-id": "<msg-456@example.com>" } });
      expect(client.fetchOne).toHaveBeenCalledWith("11", { uid: true });
      expect(client.messageCopy).toHaveBeenCalledWith("42", "Processed", { uid: true });
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(client.logout).toHaveBeenCalledTimes(1);
    });
  });

  describe("response rate calculation", () => {
    async function mockSelectCounts(replyCount: number, sentCount: number) {
      const { db } = await import("@outreachos/db");
      const makeChain = (value: unknown) => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: value }]),
        }),
      });
      vi.mocked(db.select)
        .mockReturnValueOnce(makeChain(replyCount) as never)
        .mockReturnValueOnce(makeChain(sentCount) as never);
    }

    beforeEach(async () => {
      const { db } = await import("@outreachos/db");
      vi.mocked(db.select).mockClear();
    });

    it("calculates response rate correctly", async () => {
      await mockSelectCounts(5, 100);
      const rate = await InboxService.getResponseRate("campaign-1");
      expect(rate).toBe(0.05);
    });

    it("returns 0 when no messages sent", async () => {
      await mockSelectCounts(0, 0);
      const rate = await InboxService.getResponseRate("campaign-1");
      expect(rate).toBe(0);
    });

    it("handles 100% response rate", async () => {
      await mockSelectCounts(50, 50);
      const rate = await InboxService.getResponseRate("campaign-1");
      expect(rate).toBe(1);
    });
  });

  describe("getReplies", () => {
    it("returns replies for a contact ordered by receivedAt", async () => {
      const rows = [
        {
          id: "reply-1",
          contactId: "contact-1",
          campaignId: "camp-1",
          receivedAt: new Date("2024-01-15T10:30:00.000Z"),
        },
      ];
      const orderBy = vi.fn().mockResolvedValue(rows);
      const where = vi.fn().mockReturnValue({ orderBy });
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValueOnce({ from } as never);

      const result = await InboxService.getReplies("contact-1");

      expect(result).toEqual(rows);
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledTimes(1);
      expect(orderBy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCampaignReplyCount", () => {
    it("returns the reply count for a campaign", async () => {
      const where = vi.fn().mockResolvedValue([{ count: 3 }]);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValueOnce({ from } as never);

      const result = await InboxService.getCampaignReplyCount("camp-1");

      expect(result).toBe(3);
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledTimes(1);
    });
  });

  describe("pollAndProcess", () => {
    const makeRecentRepliesChain = (rows: Array<{ imapMessageId: string | null }>) => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }),
    });

    it("labels matched Gmail replies after polling", async () => {
      vi.spyOn(InboxService, "pollForReplies").mockResolvedValue({ fetched: 2, matched: 1, errors: 0 });
      const applySpy = vi.spyOn(InboxService, "applyGmailLabel").mockResolvedValue(1);
      vi.mocked(db.select).mockReturnValueOnce(
        makeRecentRepliesChain([{ imapMessageId: "<msg-1@example.com>" }]) as never,
      );

      const result = await InboxService.pollAndProcess("account-1", baseConfig, {
        isGmail: true,
        gmailLabel: "leads",
      });

      expect(result).toEqual({ fetched: 2, matched: 1, errors: 0, labeled: 1 });
      expect(InboxService.pollForReplies).toHaveBeenCalledWith("account-1", baseConfig);
      expect(applySpy).toHaveBeenCalledWith(baseConfig, ["<msg-1@example.com>"], "leads");
    });

    it("copies matched replies to a destination folder for non-Gmail inboxes", async () => {
      vi.spyOn(InboxService, "pollForReplies").mockResolvedValue({ fetched: 2, matched: 1, errors: 0 });
      const copySpy = vi.spyOn(InboxService, "copyToFolder").mockResolvedValue(1);
      vi.mocked(db.select).mockReturnValueOnce(
        makeRecentRepliesChain([{ imapMessageId: "<msg-2@example.com>" }]) as never,
      );

      const result = await InboxService.pollAndProcess("account-1", baseConfig, {
        isGmail: false,
        destinationFolder: "Processed",
      });

      expect(result).toEqual({ fetched: 2, matched: 1, errors: 0, labeled: 1 });
      expect(InboxService.pollForReplies).toHaveBeenCalledWith("account-1", baseConfig);
      expect(copySpy).toHaveBeenCalledWith(baseConfig, ["<msg-2@example.com>"], "Processed");
    });
  });

  describe("SMTP send", () => {
    const smtpConfig = {
      host: "smtp.example.com",
      port: 587,
      user: "sender@example.com",
      password: "pass",
      secure: false,
    };

    it("creates a transporter with the correct options", () => {
      const transporter = InboxService.createSmtpTransporter(smtpConfig);
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe("function");
    });

    it("verifies SMTP connection returns true when verify succeeds", async () => {
      const transporter = InboxService.createSmtpTransporter(smtpConfig);
      vi.spyOn(transporter, "verify").mockResolvedValue(true as never);
      vi.spyOn(transporter, "close").mockImplementation(() => {});
      vi.spyOn(InboxService, "createSmtpTransporter").mockReturnValueOnce(transporter);

      const result = await InboxService.verifySmtpConnection(smtpConfig);
      expect(result).toBe(true);
    });

    it("verifies SMTP connection returns false on failure", async () => {
      const transporter = InboxService.createSmtpTransporter(smtpConfig);
      vi.spyOn(transporter, "verify").mockRejectedValue(new Error("auth failed"));
      vi.spyOn(transporter, "close").mockImplementation(() => {});
      vi.spyOn(InboxService, "createSmtpTransporter").mockReturnValueOnce(transporter);

      const result = await InboxService.verifySmtpConnection(smtpConfig);
      expect(result).toBe(false);
    });

    it("sendViaSmtp rejects when no body provided", async () => {
      await expect(
        InboxService.sendViaSmtp(smtpConfig, {
          from: "a@b.com",
          to: "c@d.com",
          subject: "Hi",
        }),
      ).rejects.toThrow("Either html or text body is required");
    });

    it("sendViaSmtp sends with html body and returns messageId", async () => {
      const transporter = InboxService.createSmtpTransporter(smtpConfig);
      vi.spyOn(transporter, "sendMail").mockResolvedValue({
        messageId: "<abc123@example.com>",
        accepted: ["recipient@example.com"],
        rejected: [],
      } as never);
      vi.spyOn(transporter, "close").mockImplementation(() => {});
      vi.spyOn(InboxService, "createSmtpTransporter").mockReturnValueOnce(transporter);

      const result = await InboxService.sendViaSmtp(smtpConfig, {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.messageId).toBe("<abc123@example.com>");
      expect(result.accepted).toEqual(["recipient@example.com"]);
      expect(result.rejected).toEqual([]);
    });
  });
});
