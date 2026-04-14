/**
 * LinkedIn copy generation quality tests — Phase 6.6
 * Tests LinkedInService methods with mocked DB and LLMService.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { LinkedInService } from "./linkedin-service.js";

vi.mock("@outreachos/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(),
  },
  linkedinPlaybooks: { id: {}, accountId: {}, contactId: {}, prompt: {}, generatedCopy: {}, status: {}, createdAt: {}, updatedAt: {} },
  contacts: { id: {}, accountId: {}, firstName: {}, lastName: {}, companyName: {}, linkedinUrl: {} },
  contactGroupMembers: { contactId: {}, groupId: {} },
  accounts: { id: {}, llmProvider: {}, llmModel: {}, byokKeys: {} },
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  count: vi.fn(() => ({})),
}));

vi.mock("./llm-service.js", () => ({
  LLMService: {
    generateLinkedInCopy: vi.fn(),
  },
}));

vi.mock("./crypto-service.js", () => ({
  CryptoService: {
    decryptKeys: vi.fn().mockReturnValue({ keys: {}, errors: [] }),
  },
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CONTACT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PLAYBOOK_ID = "pppppppp-pppp-pppp-pppp-pppppppppppp";

async function mockDb() {
  const { db } = await import("@outreachos/db");
  return vi.mocked(db);
}

async function mockLLM() {
  const { LLMService } = await import("./llm-service.js");
  return vi.mocked(LLMService);
}

describe("LinkedInService — copy generation quality", () => {
  beforeEach(async () => {
    const db = await mockDb();
    vi.mocked(db.select).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.mocked(db.update).mockReset();
    const llm = await mockLLM();
    vi.mocked(llm.generateLinkedInCopy).mockReset();
  });

  describe("generateCopy", () => {
    it("returns a playbook entry with generated copy for a contact", async () => {
      const db = await mockDb();
      const llm = await mockLLM();

      // getLLMConfig: account lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              llmProvider: "gemini",
              llmModel: null,
              byokKeys: null,
            }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      // contact lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              firstName: "Marcus",
              lastName: "Chen",
              companyName: "Lumina Systems",
              linkedinUrl: "https://linkedin.com/in/marcuschen",
            }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      llm.generateLinkedInCopy.mockResolvedValueOnce({
        text: "Hi Marcus, I noticed your work at Lumina Systems and wanted to connect.",
        inputTokens: 120,
        outputTokens: 45,
        latencyMs: 800,
      });

      const expectedEntry = {
        id: PLAYBOOK_ID,
        accountId: ACCOUNT_ID,
        contactId: CONTACT_ID,
        groupId: null,
        prompt: "Professional intro",
        generatedCopy: "Hi Marcus, I noticed your work at Lumina Systems and wanted to connect.",
        status: "generated",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedEntry]),
        }),
      } as unknown as ReturnType<typeof db.insert>);

      process.env.GEMINI_API_KEY = "test-key";
      const result = await LinkedInService.generateCopy({
        accountId: ACCOUNT_ID,
        contactId: CONTACT_ID,
        prompt: "Professional intro",
      });

      expect(result.id).toBe(PLAYBOOK_ID);
      expect(result.generatedCopy).toContain("Marcus");
      expect(result.status).toBe("generated");
      expect(llm.generateLinkedInCopy).toHaveBeenCalledOnce();
    });

    it("uses contact name and company in the LLM call", async () => {
      const db = await mockDb();
      const llm = await mockLLM();

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ llmProvider: "gemini", llmModel: null, byokKeys: null }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              firstName: "Sarah",
              lastName: "Kim",
              companyName: "NeuralPath",
              linkedinUrl: null,
            }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      llm.generateLinkedInCopy.mockResolvedValueOnce({
        text: "Hi Sarah, your work at NeuralPath stands out.",
        inputTokens: 100,
        outputTokens: 30,
        latencyMs: 700,
      });

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "x", accountId: ACCOUNT_ID, contactId: CONTACT_ID,
            groupId: null, prompt: "Re: job post", generatedCopy: "Hi Sarah, your work at NeuralPath stands out.",
            status: "generated", createdAt: new Date(), updatedAt: new Date(),
          }]),
        }),
      } as unknown as ReturnType<typeof db.insert>);

      process.env.GEMINI_API_KEY = "test-key";
      await LinkedInService.generateCopy({
        accountId: ACCOUNT_ID,
        contactId: CONTACT_ID,
        prompt: "Re: job post",
      });

      const callArgs = llm.generateLinkedInCopy.mock.calls[0];
      expect(callArgs[2]).toMatchObject({ name: "Sarah Kim", company: "NeuralPath" });
    });

    it("falls back to generic contact name when no contact found", async () => {
      const db = await mockDb();
      const llm = await mockLLM();

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ llmProvider: "gemini", llmModel: null, byokKeys: null }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // no contact
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      llm.generateLinkedInCopy.mockResolvedValueOnce({
        text: "Hi Contact, I wanted to reach out.",
        inputTokens: 80,
        outputTokens: 20,
        latencyMs: 600,
      });

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "y", accountId: ACCOUNT_ID, contactId: CONTACT_ID,
            groupId: null, prompt: "Generic outreach", generatedCopy: "Hi Contact, I wanted to reach out.",
            status: "generated", createdAt: new Date(), updatedAt: new Date(),
          }]),
        }),
      } as unknown as ReturnType<typeof db.insert>);

      process.env.GEMINI_API_KEY = "test-key";
      await LinkedInService.generateCopy({
        accountId: ACCOUNT_ID,
        contactId: CONTACT_ID,
        prompt: "Generic outreach",
      });

      const callArgs = llm.generateLinkedInCopy.mock.calls[0];
      expect(callArgs[2]).toMatchObject({ name: "Contact" });
    });
  });

  describe("recordResponse", () => {
    it("marks playbook entry as responded", async () => {
      const db = await mockDb();

      const existingEntry = {
        id: PLAYBOOK_ID, accountId: ACCOUNT_ID, contactId: CONTACT_ID,
        groupId: null, prompt: "test", generatedCopy: "Hi there",
        status: "sent", createdAt: new Date(), updatedAt: new Date(),
      };
      const updatedEntry = { ...existingEntry, status: "responded", updatedAt: new Date() };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingEntry]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      } as unknown as ReturnType<typeof db.update>);

      const result = await LinkedInService.recordResponse(
        ACCOUNT_ID, PLAYBOOK_ID, "Thanks for reaching out!", "positive",
      );

      expect(result.status).toBe("responded");
    });

    it("throws when playbook entry not found", async () => {
      const db = await mockDb();

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      await expect(
        LinkedInService.recordResponse(ACCOUNT_ID, PLAYBOOK_ID, "reply text"),
      ).rejects.toThrow("PLAYBOOK_NOT_FOUND");
    });
  });

  describe("list", () => {
    it("returns paginated entries filtered by status", async () => {
      const db = await mockDb();
      const entries = [
        { id: "e1", accountId: ACCOUNT_ID, status: "generated", createdAt: new Date(), updatedAt: new Date() },
        { id: "e2", accountId: ACCOUNT_ID, status: "generated", createdAt: new Date(), updatedAt: new Date() },
      ];

      // count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      // entries query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(entries),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await LinkedInService.list({ accountId: ACCOUNT_ID, status: "generated" });
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
