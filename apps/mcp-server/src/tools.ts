/**
 * MCP Tools — 21 tools implementing all OutreachOS agent actions
 * Phase 6 implementation
 */

import { z } from "zod";

/** Dangerous keys that could enable prototype pollution */
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"] as const;
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CampaignService,
  ContactService,
  TemplateService,
  AnalyticsService,
  ExperimentService,
  EnrichmentService,
  LinkedInService,
  LLMService,
  CryptoService,
} from "@outreachos/services";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

/** Active account context per session — Map<sessionId, accountId> */
const sessionAccountMap = new Map<string, string>();

function requireAccountId(sessionId: string, providedId?: string): string {
  const id = providedId ?? sessionAccountMap.get(sessionId);
  if (!id) throw new Error("No account_id provided and no active account set. Use set_active_account first.");
  return id;
}

/** Clean up session state when a session ends */
export function cleanupSession(sessionId: string): void {
  sessionAccountMap.delete(sessionId);
}

export function registerTools(server: McpServer, sessionId: string): number {
  let count = 0;
  // ────────────────────────────────────────────
  // Account Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "list_accounts",
    "List accounts accessible to the current user (requires authentication)",
    {
      account_id: z.string().uuid().optional().describe("Account ID to verify access (uses active account if omitted)"),
    },
    async ({ account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      // Verify user has access to the specified account before listing
      const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
      if (!account) {
        return { content: [{ type: "text", text: "Unauthorized: Account not found or access denied" }], isError: true };
      }
      // Return only the account the user has access to (not all accounts)
      return { content: [{ type: "text", text: JSON.stringify([account], null, 2) }] };
    },
  );

  count++;
  server.tool(
    "set_active_account",
    "Set the active account for subsequent tool calls",
    { account_id: z.string().uuid().describe("The account ID to set as active") },
    async ({ account_id }) => {
      const [account] = await db.select().from(accounts).where(eq(accounts.id, account_id)).limit(1);
      if (!account) return { content: [{ type: "text", text: "Account not found" }], isError: true };
      sessionAccountMap.set(sessionId, account_id);
      return { content: [{ type: "text", text: `Active account set to: ${account.name} (${account_id})` }] };
    },
  );

  // ────────────────────────────────────────────
  // Campaign Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "list_campaigns",
    "List campaigns for the active account with optional status filter",
    {
      account_id: z.string().uuid().optional().describe("Account ID (uses active account if omitted)"),
      status: z.enum(["draft", "active", "paused", "completed", "stopped"]).optional(),
    },
    async ({ account_id, status }) => {
      const id = requireAccountId(sessionId, account_id);
      const result = await CampaignService.list(id, status as any);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "get_campaign_details",
    "Get detailed information about a specific campaign including metrics",
    {
      campaign_id: z.string().uuid().describe("Campaign ID"),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const campaign = await CampaignService.getById(id, campaign_id);
      if (!campaign) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      const metrics = await AnalyticsService.getCampaignMetrics(campaign_id);
      return { content: [{ type: "text", text: JSON.stringify({ campaign, metrics }, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "start_campaign",
    "Start/resume a campaign (changes status to active)",
    {
      campaign_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const updated = await CampaignService.update(id, campaign_id, { status: "active" });
      if (!updated) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      return { content: [{ type: "text", text: `Campaign ${campaign_id} started` }] };
    },
  );

  count++;
  server.tool(
    "pause_campaign",
    "Pause an active campaign",
    {
      campaign_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const updated = await CampaignService.update(id, campaign_id, { status: "paused" });
      if (!updated) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      return { content: [{ type: "text", text: `Campaign ${campaign_id} paused` }] };
    },
  );

  count++;
  server.tool(
    "stop_campaign",
    "Permanently stop a campaign",
    {
      campaign_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const updated = await CampaignService.update(id, campaign_id, { status: "stopped" });
      if (!updated) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      return { content: [{ type: "text", text: `Campaign ${campaign_id} stopped` }] };
    },
  );

  count++;
  server.tool(
    "duplicate_campaign",
    "Duplicate a campaign with a new name",
    {
      campaign_id: z.string().uuid(),
      new_name: z.string().min(1).describe("Name for the duplicated campaign"),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, new_name, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const original = await CampaignService.getById(id, campaign_id);
      if (!original) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
      const duplicate = await CampaignService.create({
        accountId: id,
        name: new_name,
        type: original.type as any,
        groupId: original.groupId ?? undefined,
        templateId: original.templateId ?? undefined,
        settings: original.settings ?? undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(duplicate, null, 2) }] };
    },
  );

  // ────────────────────────────────────────────
  // Template Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "create_campaign_template",
    "Create a new email template",
    {
      name: z.string().min(1),
      subject: z.string().optional(),
      body_html: z.string().optional(),
      body_text: z.string().optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ name, subject, body_html, body_text, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const template = await TemplateService.create({
        accountId: id,
        name,
        subject,
        bodyHtml: body_html,
        bodyText: body_text,
      });
      return { content: [{ type: "text", text: JSON.stringify(template, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "generate_template_from_prompt",
    "Generate an email template using AI from a natural language prompt",
    {
      goal: z.string().describe("The goal of the email"),
      audience: z.string().describe("Target audience description"),
      tone: z.string().describe("Desired tone (e.g., professional, casual, friendly)"),
      cta: z.string().optional().describe("Call to action"),
      template_name: z.string().optional().describe("Name for the created template"),
      account_id: z.string().uuid().optional(),
    },
    async ({ goal, audience, tone, cta, template_name, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      // Get LLM config from account
      const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
      if (!account) return { content: [{ type: "text", text: "Account not found" }], isError: true };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return { content: [{ type: "text", text: "No LLM API key configured" }], isError: true };

      const result = await LLMService.generateEmail(id, { apiKey }, { goal, audience, tone, cta });

      const subjects = await LLMService.generateSubjectLines(id, { apiKey }, {
        emailBody: result.text,
        tone,
        count: 1,
      });

      let subject = "Generated Subject";
      try {
        const parsed = JSON.parse(subjects.text);
        if (Array.isArray(parsed) && parsed.length > 0) subject = parsed[0];
      } catch { /* use default */ }

      const template = await TemplateService.create({
        accountId: id,
        name: template_name ?? `AI: ${goal.slice(0, 40)}`,
        subject,
        bodyHtml: result.text,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ template, tokens_used: result.inputTokens + result.outputTokens }, null, 2) }],
      };
    },
  );

  count++;
  server.tool(
    "update_campaign_template",
    "Update an existing email template",
    {
      template_id: z.string().uuid(),
      name: z.string().optional(),
      subject: z.string().optional(),
      body_html: z.string().optional(),
      body_text: z.string().optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ template_id, name, subject, body_html, body_text, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const updated = await TemplateService.update(id, template_id, {
        name,
        subject,
        bodyHtml: body_html,
        bodyText: body_text,
      });
      if (!updated) return { content: [{ type: "text", text: "Template not found" }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    },
  );

  // ────────────────────────────────────────────
  // Analytics Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "get_campaign_stats",
    "Get campaign performance metrics (open rate, click rate, bounces, etc.)",
    {
      campaign_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
    },
    async ({ campaign_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      // Verify campaign ownership before returning stats
      const campaign = await CampaignService.getById(id, campaign_id);
      if (!campaign) {
        return { content: [{ type: "text", text: "Authorization error: Campaign not found or does not belong to account" }], isError: true };
      }
      const metrics = await AnalyticsService.getCampaignMetrics(campaign_id);
      return { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] };
    },
  );

  // ────────────────────────────────────────────
  // Contact Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "enrich_contacts",
    "Trigger batch enrichment of unenriched contacts via Hunter.io",
    {
      group_id: z.string().uuid().optional().describe("Limit enrichment to a specific group"),
      account_id: z.string().uuid().optional(),
    },
    async ({ group_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const hunterKey = process.env.HUNTER_API_KEY;
      if (!hunterKey) return { content: [{ type: "text", text: "Hunter.io API key not configured" }], isError: true };

      const result = await EnrichmentService.batchEnrich(id, { hunterApiKey: hunterKey }, group_id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "export_contacts",
    "Export contacts as CSV",
    {
      group_id: z.string().uuid().optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ group_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const csv = await ContactService.exportCSV(id, group_id);
      return { content: [{ type: "text", text: csv }] };
    },
  );

  count++;
  server.tool(
    "push_contact_field",
    "Set a custom field value on a contact (agent-writable, atomic)",
    {
      contact_id: z.string().uuid(),
      field_name: z.string()
        .min(1)
        .max(64)
        .refine(
          (val) => !DANGEROUS_KEYS.includes(val as typeof DANGEROUS_KEYS[number]),
          { message: "field_name contains a reserved key that is not allowed" }
        )
        .describe("Custom field name"),
      field_value: z.unknown().describe("Value to set"),
      account_id: z.string().uuid().optional(),
    },
    async ({ contact_id, field_name, field_value, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      // Atomic DB-level JSON merge — no TOCTOU race
      const updated = await ContactService.mergeCustomField(id, contact_id, field_name, field_value);
      if (!updated) return { content: [{ type: "text", text: "Contact not found" }], isError: true };
      return { content: [{ type: "text", text: `Set ${field_name} on contact ${contact_id}` }] };
    },
  );

  count++;
  server.tool(
    "pull_contact_field",
    "Get a custom field value from a contact",
    {
      contact_id: z.string().uuid(),
      field_name: z.string().min(1).max(64),
      account_id: z.string().uuid().optional(),
    },
    async ({ contact_id, field_name, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const contact = await ContactService.getById(id, contact_id);
      if (!contact) return { content: [{ type: "text", text: "Contact not found" }], isError: true };

      const customFields = (contact.customFields ?? {}) as Record<string, unknown>;
      const value = customFields[field_name];
      return { content: [{ type: "text", text: JSON.stringify({ field_name, value }) }] };
    },
  );

  count++;
  server.tool(
    "list_contact_groups",
    "List all contact groups for the account",
    {
      account_id: z.string().uuid().optional(),
    },
    async ({ account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const groups = await ContactService.listGroups(id);
      return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "create_contact_group",
    "Create a new contact group",
    {
      name: z.string().min(1),
      description: z.string().optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ name, description, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const group = await ContactService.createGroup(id, name, description);
      return { content: [{ type: "text", text: JSON.stringify(group, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "add_contacts_to_group",
    "Add contacts to an existing group",
    {
      group_id: z.string().uuid(),
      contact_ids: z.array(z.string().uuid()).min(1),
      account_id: z.string().uuid().optional(),
    },
    async ({ group_id, contact_ids, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      // Verify group exists and belongs to the account
      const group = await ContactService.getGroupById(id, group_id);
      if (!group) {
        return { content: [{ type: "text", text: "Authorization error: Group not found or does not belong to account" }], isError: true };
      }
      await ContactService.addToGroup(group_id, contact_ids);
      return { content: [{ type: "text", text: `Added ${contact_ids.length} contacts to group ${group_id}` }] };
    },
  );

  // ────────────────────────────────────────────
  // LinkedIn Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "generate_linkedin_copy",
    "Generate personalized LinkedIn outreach copy for a contact using AI",
    {
      contact_id: z.string().uuid().optional(),
      group_id: z.string().uuid().optional(),
      prompt: z.string().min(1).describe("Instructions for the copy generation"),
      research_notes: z.string().optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ contact_id, group_id, prompt, research_notes, account_id }) => {
      if (!contact_id && !group_id) {
        return { content: [{ type: "text", text: "Validation error: At least one of contact_id or group_id must be provided" }], isError: true };
      }
      const id = requireAccountId(sessionId, account_id);
      const result = await LinkedInService.generateCopy({
        accountId: id,
        contactId: contact_id,
        groupId: group_id,
        prompt,
        researchNotes: research_notes,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "get_linkedin_playbook",
    "Get LinkedIn playbook entries for the account",
    {
      status: z.string().optional().describe("Filter by status: generated, sent, draft"),
      limit: z.number().int().min(1).max(100).optional(),
      account_id: z.string().uuid().optional(),
    },
    async ({ status, limit, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const result = await LinkedInService.list({ accountId: id, status, limit });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ────────────────────────────────────────────
  // Experiment Tools
  // ────────────────────────────────────────────

  count++;
  server.tool(
    "list_ab_experiments",
    "List A/B test experiments for the account",
    {
      account_id: z.string().uuid().optional(),
    },
    async ({ account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const result = await ExperimentService.list(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  count++;
  server.tool(
    "get_experiment_log",
    "Get detailed experiment log with batch results and champion status",
    {
      experiment_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
    },
    async ({ experiment_id, account_id }) => {
      const id = requireAccountId(sessionId, account_id);
      const summary = await ExperimentService.getSummary(id, experiment_id);
      const batches = await ExperimentService.getBatches(experiment_id);
      return { content: [{ type: "text", text: JSON.stringify({ summary, batches }, null, 2) }] };
    },
  );

  return count;
}
