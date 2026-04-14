/**
 * Multi-account isolation tests — Phase 6.6
 * Verifies that MCP tools enforce account boundaries and cannot
 * access data belonging to other accounts.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";

vi.mock("@outreachos/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  },
  accounts: { id: {}, name: {} },
  eq: vi.fn(() => ({})),
}));

vi.mock("@outreachos/services", () => ({
  CampaignService: {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "new" }),
  },
  TemplateService: {
    create: vi.fn().mockResolvedValue({ id: "tpl-1" }),
    update: vi.fn().mockResolvedValue(null),
  },
  AnalyticsService: {
    getCampaignMetrics: vi.fn().mockResolvedValue({}),
  },
  ContactService: {
    exportCSV: vi.fn().mockResolvedValue(""),
    mergeCustomField: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    listGroups: vi.fn().mockResolvedValue([]),
    createGroup: vi.fn().mockResolvedValue({ id: "g-1" }),
    getGroupById: vi.fn().mockResolvedValue(null),
    addToGroup: vi.fn().mockResolvedValue(undefined),
  },
  EnrichmentService: { batchEnrich: vi.fn().mockResolvedValue({}) },
  LinkedInService: {
    generateCopy: vi.fn().mockResolvedValue({ id: "pb-1", status: "generated" }),
    list: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    recordResponse: vi.fn().mockResolvedValue({ id: "pb-1", status: "responded" }),
  },
  LLMService: {
    generateEmail: vi.fn().mockResolvedValue({ text: "", inputTokens: 0, outputTokens: 0, latencyMs: 0 }),
    generateSubjectLines: vi.fn().mockResolvedValue({ text: "[]", inputTokens: 0, outputTokens: 0, latencyMs: 0 }),
  },
  ExperimentService: {
    list: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue(null),
    getBatches: vi.fn().mockResolvedValue([]),
  },
  CryptoService: {},
}));

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CAMPAIGN_OF_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CONTACT_OF_A = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const GROUP_OF_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

/** Call a registered tool by name through the McpServer's internal registry. */
async function callTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  // _registeredTools is a plain object keyed by tool name in the MCP SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<string, { handler: (a: unknown) => Promise<unknown> }>;
  const tool = tools?.[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool.handler(args) as ReturnType<typeof callTool>;
}

describe("Multi-account isolation", () => {
  let serverA: McpServer;
  let serverB: McpServer;
  const SESSION_A = "session-a";
  const SESSION_B = "session-b";

  beforeEach(() => {
    serverA = new McpServer({ name: "test-a", version: "0.0.1" });
    serverB = new McpServer({ name: "test-b", version: "0.0.1" });
    registerTools(serverA, SESSION_A);
    registerTools(serverB, SESSION_B);
  });

  describe("session state isolation", () => {
    it("active account is per-session — session B cannot read session A's active account", async () => {
      const { db } = await import("@outreachos/db");

      // Set account A on session A
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: ACCOUNT_A, name: "Acme" }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);
      await callTool(serverA, "set_active_account", { account_id: ACCOUNT_A });

      // Session B has no active account — should fail without explicit account_id
      await expect(
        callTool(serverB, "list_campaigns", {}),
      ).rejects.toThrow("No account_id provided");
    });

    it("setting active account on session B does not affect session A", async () => {
      const { db } = await import("@outreachos/db");
      const { CampaignService } = await import("@outreachos/services");

      // Activate account A on session A
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: ACCOUNT_A, name: "Acme" }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);
      await callTool(serverA, "set_active_account", { account_id: ACCOUNT_A });

      // Activate account B on session B
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: ACCOUNT_B, name: "Beta Corp" }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);
      await callTool(serverB, "set_active_account", { account_id: ACCOUNT_B });

      // Session A should still call with ACCOUNT_A
      vi.mocked(CampaignService.list).mockClear();
      await callTool(serverA, "list_campaigns", {});
      expect(CampaignService.list).toHaveBeenCalledWith(ACCOUNT_A, undefined);

      // Session B should call with ACCOUNT_B
      vi.mocked(CampaignService.list).mockClear();
      await callTool(serverB, "list_campaigns", {});
      expect(CampaignService.list).toHaveBeenCalledWith(ACCOUNT_B, undefined);
    });
  });

  describe("ownership enforcement — campaigns", () => {
    it("get_campaign_details — returns error when campaign belongs to different account", async () => {
      const { CampaignService } = await import("@outreachos/services");
      // Account B tries to get campaign owned by A — service returns null (not found for that account)
      vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "get_campaign_details", {
        campaign_id: CAMPAIGN_OF_A,
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
      expect(CampaignService.getById).toHaveBeenCalledWith(ACCOUNT_B, CAMPAIGN_OF_A);
    });

    it("start_campaign — returns error when campaign not found for account", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.update).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "start_campaign", {
        campaign_id: CAMPAIGN_OF_A,
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
      expect(CampaignService.update).toHaveBeenCalledWith(ACCOUNT_B, CAMPAIGN_OF_A, { status: "active" });
    });

    it("get_campaign_stats — blocks cross-account access", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "get_campaign_stats", {
        campaign_id: CAMPAIGN_OF_A,
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("ownership enforcement — contacts", () => {
    it("pull_contact_field — returns error when contact not owned by account", async () => {
      const { ContactService } = await import("@outreachos/services");
      vi.mocked(ContactService.getById).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "pull_contact_field", {
        contact_id: CONTACT_OF_A,
        field_name: "score",
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
      expect(ContactService.getById).toHaveBeenCalledWith(ACCOUNT_B, CONTACT_OF_A);
    });

    it("push_contact_field — returns error when contact not found for account", async () => {
      const { ContactService } = await import("@outreachos/services");
      vi.mocked(ContactService.mergeCustomField).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "push_contact_field", {
        contact_id: CONTACT_OF_A,
        field_name: "score",
        field_value: 99,
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
      expect(ContactService.mergeCustomField).toHaveBeenCalledWith(ACCOUNT_B, CONTACT_OF_A, "score", 99);
    });
  });

  describe("ownership enforcement — groups", () => {
    it("add_contacts_to_group — rejects when group belongs to different account", async () => {
      const { ContactService } = await import("@outreachos/services");
      vi.mocked(ContactService.getGroupById).mockResolvedValueOnce(null as never);
      const result = await callTool(serverB, "add_contacts_to_group", {
        group_id: GROUP_OF_A,
        contact_ids: [CONTACT_OF_A],
        account_id: ACCOUNT_B,
      });
      expect(result.isError).toBe(true);
      expect(ContactService.getGroupById).toHaveBeenCalledWith(ACCOUNT_B, GROUP_OF_A);
    });
  });

  describe("ownership enforcement — linkedin", () => {
    it("record_linkedin_response — service is called with the correct (requesting) account", async () => {
      const { LinkedInService } = await import("@outreachos/services");
      const PB_ID = "pppppppp-pppp-pppp-pppp-pppppppppppp";
      await callTool(serverB, "record_linkedin_response", {
        playbook_id: PB_ID,
        response_text: "Hello",
        account_id: ACCOUNT_B,
      });
      // Service must be called with B's account — service itself enforces ownership via accountId filter
      expect(LinkedInService.recordResponse).toHaveBeenCalledWith(
        ACCOUNT_B, PB_ID, "Hello", "neutral",
      );
    });
  });

  describe("field name injection guard", () => {
    it("push_contact_field — blocks __proto__ field name (returns isError)", async () => {
      // Zod refine catches forbidden keys; MCP SDK returns isError response rather than throwing
      const result = await callTool(serverA, "push_contact_field", {
        contact_id: CONTACT_OF_A,
        field_name: "__proto__",
        field_value: "evil",
        account_id: ACCOUNT_A,
      });
      expect(result.isError).toBe(true);
    });

    it("push_contact_field — blocks constructor field name (returns isError)", async () => {
      const result = await callTool(serverA, "push_contact_field", {
        contact_id: CONTACT_OF_A,
        field_name: "constructor",
        field_value: "evil",
        account_id: ACCOUNT_A,
      });
      expect(result.isError).toBe(true);
    });
  });
});
