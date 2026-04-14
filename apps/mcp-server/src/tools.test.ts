/**
 * MCP Tool Integration Tests — Phase 6.6
 * Exercises every registered tool with mocked service layer.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";

// ── Mock all service dependencies ─────────────────────────────────────────────
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
    create: vi.fn().mockResolvedValue({ id: "camp-new" }),
    update: vi.fn().mockResolvedValue({ id: "camp-1", status: "active" }),
  },
  TemplateService: {
    create: vi.fn().mockResolvedValue({ id: "tpl-1" }),
    update: vi.fn().mockResolvedValue({ id: "tpl-1" }),
  },
  AnalyticsService: {
    getCampaignMetrics: vi.fn().mockResolvedValue({ sent: 100, opens: 40 }),
  },
  ContactService: {
    exportCSV: vi.fn().mockResolvedValue("email,name\ntest@example.com,Test"),
    mergeCustomField: vi.fn().mockResolvedValue({ id: "c-1" }),
    getById: vi.fn().mockResolvedValue({ id: "c-1", customFields: { score: 9 } }),
    listGroups: vi.fn().mockResolvedValue([]),
    createGroup: vi.fn().mockResolvedValue({ id: "g-1" }),
    getGroupById: vi.fn().mockResolvedValue({ id: "g-1" }),
    addToGroup: vi.fn().mockResolvedValue(undefined),
  },
  EnrichmentService: {
    batchEnrich: vi.fn().mockResolvedValue({ enriched: 5, failed: 0 }),
  },
  LinkedInService: {
    generateCopy: vi.fn().mockResolvedValue({ id: "pb-1", generatedCopy: "Hi there", status: "generated" }),
    list: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    recordResponse: vi.fn().mockResolvedValue({ id: "pb-1", status: "responded" }),
  },
  LLMService: {
    generateEmail: vi.fn().mockResolvedValue({ text: "<p>Hello</p>", inputTokens: 50, outputTokens: 30, latencyMs: 400 }),
    generateSubjectLines: vi.fn().mockResolvedValue({ text: '["Great Subject"]', inputTokens: 20, outputTokens: 10, latencyMs: 200 }),
  },
  ExperimentService: {
    list: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue({ id: "exp-1" }),
    getBatches: vi.fn().mockResolvedValue([]),
  },
  CryptoService: {},
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const SESSION = "test-session-id";
const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CONTACT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const GROUP_ID = "gggggggg-gggg-gggg-gggg-gggggggggggg";
const TPL_ID = "tttttttt-tttt-tttt-tttt-tttttttttttt";
const EXP_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const PB_ID = "pppppppp-pppp-pppp-pppp-pppppppppppp";

/** Call a registered tool by name through the McpServer's tool registry. */
async function callTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  // _registeredTools is a plain object keyed by tool name in the MCP SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<string, { handler: (args: unknown) => Promise<unknown> }>;
  const tool = tools?.[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool.handler(args) as ReturnType<typeof callTool>;
}

describe("MCP Tools — integration", () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: "test", version: "0.0.1" });
    registerTools(server, SESSION);
  });

  describe("registerTools", () => {
    it("registers 22 tools (21 original + record_linkedin_response)", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools = (server as any)._registeredTools as Record<string, unknown>;
      expect(Object.keys(tools ?? {}).length).toBeGreaterThanOrEqual(22);
    });
  });

  describe("account tools", () => {
    it("set_active_account — stores and confirms account when found", async () => {
      const { db } = await import("@outreachos/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: ACCOUNT_ID, name: "Acme" }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await callTool(server, "set_active_account", { account_id: ACCOUNT_ID });
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("Acme");
    });

    it("set_active_account — returns error when account not found", async () => {
      const { db } = await import("@outreachos/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await callTool(server, "set_active_account", { account_id: ACCOUNT_ID });
      expect(result.isError).toBe(true);
    });

    it("list_accounts — returns authorized account data", async () => {
      const { db } = await import("@outreachos/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: ACCOUNT_ID, name: "Acme" }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await callTool(server, "list_accounts", { account_id: ACCOUNT_ID });
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain(ACCOUNT_ID);
    });
  });

  describe("campaign tools", () => {
    it("list_campaigns — calls CampaignService.list with account id", async () => {
      const { CampaignService } = await import("@outreachos/services");
      const result = await callTool(server, "list_campaigns", { account_id: ACCOUNT_ID });
      expect(CampaignService.list).toHaveBeenCalledWith(ACCOUNT_ID, undefined);
      expect(result.isError).toBeFalsy();
    });

    it("get_campaign_details — returns error when campaign not found", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as never);
      const result = await callTool(server, "get_campaign_details", { campaign_id: CAMPAIGN_ID, account_id: ACCOUNT_ID });
      expect(result.isError).toBe(true);
    });

    it("start_campaign — updates status to active", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.update).mockResolvedValueOnce({ id: CAMPAIGN_ID, status: "active" } as never);
      const result = await callTool(server, "start_campaign", { campaign_id: CAMPAIGN_ID, account_id: ACCOUNT_ID });
      expect(CampaignService.update).toHaveBeenCalledWith(ACCOUNT_ID, CAMPAIGN_ID, { status: "active" });
      expect(result.content[0].text).toContain("started");
    });

    it("pause_campaign — updates status to paused", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.update).mockResolvedValueOnce({ id: CAMPAIGN_ID, status: "paused" } as never);
      const result = await callTool(server, "pause_campaign", { campaign_id: CAMPAIGN_ID, account_id: ACCOUNT_ID });
      expect(CampaignService.update).toHaveBeenCalledWith(ACCOUNT_ID, CAMPAIGN_ID, { status: "paused" });
      expect(result.content[0].text).toContain("paused");
    });

    it("stop_campaign — updates status to stopped", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.update).mockResolvedValueOnce({ id: CAMPAIGN_ID, status: "stopped" } as never);
      const result = await callTool(server, "stop_campaign", { campaign_id: CAMPAIGN_ID, account_id: ACCOUNT_ID });
      expect(CampaignService.update).toHaveBeenCalledWith(ACCOUNT_ID, CAMPAIGN_ID, { status: "stopped" });
      expect(result.content[0].text).toContain("stopped");
    });

    it("duplicate_campaign — creates new campaign from original", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.getById).mockResolvedValueOnce({
        id: CAMPAIGN_ID, type: "outreach", name: "Old", accountId: ACCOUNT_ID,
        groupId: null, templateId: null, settings: null,
      } as never);
      vi.mocked(CampaignService.create).mockResolvedValueOnce({ id: "camp-dup" } as never);

      const result = await callTool(server, "duplicate_campaign", {
        campaign_id: CAMPAIGN_ID,
        new_name: "Old (copy)",
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBeFalsy();
      expect(CampaignService.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Old (copy)" }));
    });
  });

  describe("template tools", () => {
    it("create_campaign_template — creates and returns template", async () => {
      const { TemplateService } = await import("@outreachos/services");
      const result = await callTool(server, "create_campaign_template", {
        name: "Follow-up",
        subject: "Following up",
        body_html: "<p>Hey</p>",
        account_id: ACCOUNT_ID,
      });
      expect(TemplateService.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Follow-up" }));
      expect(result.isError).toBeFalsy();
    });

    it("update_campaign_template — returns error when not found", async () => {
      const { TemplateService } = await import("@outreachos/services");
      vi.mocked(TemplateService.update).mockResolvedValueOnce(null as never);
      const result = await callTool(server, "update_campaign_template", {
        template_id: TPL_ID,
        name: "Updated",
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("analytics tools", () => {
    it("get_campaign_stats — verifies ownership before returning metrics", async () => {
      const { CampaignService, AnalyticsService } = await import("@outreachos/services");
      vi.mocked(CampaignService.getById).mockResolvedValueOnce({ id: CAMPAIGN_ID } as never);
      const result = await callTool(server, "get_campaign_stats", {
        campaign_id: CAMPAIGN_ID,
        account_id: ACCOUNT_ID,
      });
      expect(AnalyticsService.getCampaignMetrics).toHaveBeenCalledWith(CAMPAIGN_ID);
      expect(result.isError).toBeFalsy();
    });

    it("get_campaign_stats — returns error when campaign not owned by account", async () => {
      const { CampaignService } = await import("@outreachos/services");
      vi.mocked(CampaignService.getById).mockResolvedValueOnce(null as never);
      const result = await callTool(server, "get_campaign_stats", {
        campaign_id: CAMPAIGN_ID,
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("contact tools", () => {
    it("export_contacts — returns CSV text", async () => {
      const { ContactService } = await import("@outreachos/services");
      const result = await callTool(server, "export_contacts", { account_id: ACCOUNT_ID });
      expect(ContactService.exportCSV).toHaveBeenCalledWith(ACCOUNT_ID, undefined);
      expect(result.content[0].text).toContain("email");
    });

    it("push_contact_field — calls mergeCustomField with correct args", async () => {
      const { ContactService } = await import("@outreachos/services");
      const result = await callTool(server, "push_contact_field", {
        contact_id: CONTACT_ID,
        field_name: "score",
        field_value: 10,
        account_id: ACCOUNT_ID,
      });
      expect(ContactService.mergeCustomField).toHaveBeenCalledWith(ACCOUNT_ID, CONTACT_ID, "score", 10);
      expect(result.content[0].text).toContain("score");
    });

    it("pull_contact_field — returns field value from contact", async () => {
      const result = await callTool(server, "pull_contact_field", {
        contact_id: CONTACT_ID,
        field_name: "score",
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text) as { value: unknown };
      expect(parsed.value).toBe(9);
    });

    it("list_contact_groups — returns group list", async () => {
      const { ContactService } = await import("@outreachos/services");
      const result = await callTool(server, "list_contact_groups", { account_id: ACCOUNT_ID });
      expect(ContactService.listGroups).toHaveBeenCalledWith(ACCOUNT_ID);
      expect(result.isError).toBeFalsy();
    });

    it("create_contact_group — creates group and returns it", async () => {
      const { ContactService } = await import("@outreachos/services");
      const result = await callTool(server, "create_contact_group", {
        name: "VIPs",
        account_id: ACCOUNT_ID,
      });
      expect(ContactService.createGroup).toHaveBeenCalledWith(ACCOUNT_ID, "VIPs", undefined);
      expect(result.isError).toBeFalsy();
    });

    it("add_contacts_to_group — verifies group ownership before adding", async () => {
      const { ContactService } = await import("@outreachos/services");
      vi.mocked(ContactService.getGroupById).mockResolvedValueOnce({ id: GROUP_ID } as never);
      const result = await callTool(server, "add_contacts_to_group", {
        group_id: GROUP_ID,
        contact_ids: [CONTACT_ID],
        account_id: ACCOUNT_ID,
      });
      expect(ContactService.addToGroup).toHaveBeenCalledWith(GROUP_ID, [CONTACT_ID]);
      expect(result.content[0].text).toContain("Added 1");
    });

    it("add_contacts_to_group — returns error if group not owned by account", async () => {
      const { ContactService } = await import("@outreachos/services");
      vi.mocked(ContactService.getGroupById).mockResolvedValueOnce(null as never);
      const result = await callTool(server, "add_contacts_to_group", {
        group_id: GROUP_ID,
        contact_ids: [CONTACT_ID],
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("linkedin tools", () => {
    it("generate_linkedin_copy — calls LinkedInService.generateCopy", async () => {
      const { LinkedInService } = await import("@outreachos/services");
      const result = await callTool(server, "generate_linkedin_copy", {
        contact_id: CONTACT_ID,
        prompt: "Professional intro",
        account_id: ACCOUNT_ID,
      });
      expect(LinkedInService.generateCopy).toHaveBeenCalledWith(expect.objectContaining({
        accountId: ACCOUNT_ID,
        contactId: CONTACT_ID,
        prompt: "Professional intro",
      }));
      expect(result.isError).toBeFalsy();
    });

    it("generate_linkedin_copy — returns error when neither contact_id nor group_id provided", async () => {
      const result = await callTool(server, "generate_linkedin_copy", {
        prompt: "Hello",
        account_id: ACCOUNT_ID,
      });
      expect(result.isError).toBe(true);
    });

    it("get_linkedin_playbook — returns playbook entries", async () => {
      const { LinkedInService } = await import("@outreachos/services");
      const result = await callTool(server, "get_linkedin_playbook", { account_id: ACCOUNT_ID });
      expect(LinkedInService.list).toHaveBeenCalledWith(expect.objectContaining({ accountId: ACCOUNT_ID }));
      expect(result.isError).toBeFalsy();
    });

    it("record_linkedin_response — records response and returns updated entry", async () => {
      const { LinkedInService } = await import("@outreachos/services");
      vi.mocked(LinkedInService.recordResponse).mockResolvedValueOnce({
        id: PB_ID, accountId: ACCOUNT_ID, contactId: CONTACT_ID,
        groupId: null, prompt: null, generatedCopy: null,
        status: "responded", createdAt: new Date(), updatedAt: new Date(),
      });
      const result = await callTool(server, "record_linkedin_response", {
        playbook_id: PB_ID,
        response_text: "Thanks!",
        outcome: "positive",
        account_id: ACCOUNT_ID,
      });
      expect(LinkedInService.recordResponse).toHaveBeenCalledWith(
        ACCOUNT_ID, PB_ID, "Thanks!", "positive",
      );
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text) as { status: string };
      expect(parsed.status).toBe("responded");
    });
  });

  describe("experiment tools", () => {
    it("list_ab_experiments — calls ExperimentService.list", async () => {
      const { ExperimentService } = await import("@outreachos/services");
      const result = await callTool(server, "list_ab_experiments", { account_id: ACCOUNT_ID });
      expect(ExperimentService.list).toHaveBeenCalledWith(ACCOUNT_ID);
      expect(result.isError).toBeFalsy();
    });

    it("get_experiment_log — returns summary and batches", async () => {
      const { ExperimentService } = await import("@outreachos/services");
      const result = await callTool(server, "get_experiment_log", {
        experiment_id: EXP_ID,
        account_id: ACCOUNT_ID,
      });
      expect(ExperimentService.getSummary).toHaveBeenCalledWith(ACCOUNT_ID, EXP_ID);
      expect(ExperimentService.getBatches).toHaveBeenCalledWith(EXP_ID);
      const parsed = JSON.parse(result.content[0].text) as { summary: unknown; batches: unknown[] };
      expect(parsed).toHaveProperty("summary");
      expect(parsed).toHaveProperty("batches");
    });
  });

  describe("no active account guard", () => {
    it("throws when no account_id provided and no active account set", async () => {
      const freshServer = new McpServer({ name: "fresh", version: "0.0.1" });
      registerTools(freshServer, "fresh-session-no-account");
      await expect(
        callTool(freshServer, "list_campaigns", {}),
      ).rejects.toThrow("No account_id provided");
    });
  });
});
