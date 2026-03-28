/**
 * MCP Resources — 4 read-only resources for OutreachOS
 * Phase 6 implementation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db, campaigns, messageInstances, emailEvents, contacts, experiments, experimentBatches, replies } from "@outreachos/db";
import { eq, and, desc, sql, count, gte } from "drizzle-orm";

export function registerResources(server: McpServer): number {
  let count = 0;
  // ────────────────────────────────────────────
  // 1. Campaign Performance Summary
  // ────────────────────────────────────────────

  count++;
  server.resource(
    "campaign_performance_summary",
    "outreachos://resources/campaign-performance",
    { description: "Aggregated performance summary across all active campaigns" },
    async () => {
      const activeCampaigns = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          type: campaigns.type,
          status: campaigns.status,
          startedAt: campaigns.startedAt,
        })
        .from(campaigns)
        .where(eq(campaigns.status, "active"))
        .orderBy(desc(campaigns.startedAt))
        .limit(20);

      const summaries = [];
      for (const campaign of activeCampaigns) {
        const [stats] = await db
          .select({
            total: sql<number>`COUNT(*)::int`,
            sent: sql<number>`COUNT(*) FILTER (WHERE ${messageInstances.status} IN ('sent','delivered','opened','clicked'))::int`,
            opened: sql<number>`COUNT(*) FILTER (WHERE ${messageInstances.status} IN ('opened','clicked'))::int`,
            bounced: sql<number>`COUNT(*) FILTER (WHERE ${messageInstances.status} = 'bounced')::int`,
          })
          .from(messageInstances)
          .where(eq(messageInstances.campaignId, campaign.id));

        summaries.push({
          ...campaign,
          metrics: {
            totalMessages: stats.total,
            sent: stats.sent,
            opened: stats.opened,
            bounced: stats.bounced,
            openRate: stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) + "%" : "0%",
          },
        });
      }

      return {
        contents: [{
          uri: "outreachos://resources/campaign-performance",
          text: JSON.stringify({ activeCampaigns: summaries, generatedAt: new Date().toISOString() }, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  // ────────────────────────────────────────────
  // 2. Contact Schema
  // ────────────────────────────────────────────

  count++;
  server.resource(
    "contact_schema",
    "outreachos://resources/contact-schema",
    { description: "Schema definition for contacts including custom fields" },
    async () => {
      const schema = {
        table: "contacts",
        columns: {
          id: { type: "uuid", primaryKey: true },
          accountId: { type: "uuid", required: true },
          firstName: { type: "text", required: true },
          lastName: { type: "text", required: true },
          email: { type: "text" },
          businessWebsite: { type: "text" },
          companyName: { type: "text" },
          city: { type: "text" },
          state: { type: "text" },
          linkedinUrl: { type: "text" },
          hunterScore: { type: "integer", description: "Hunter.io email deliverability score (0-100)" },
          hunterStatus: { type: "text", description: "Hunter.io verification status" },
          unsubscribed: { type: "boolean", default: false },
          replied: { type: "boolean", default: false },
          customFields: {
            type: "jsonb",
            description: "Agent-writable key-value pairs. Use push_contact_field / pull_contact_field tools.",
          },
          createdAt: { type: "timestamptz" },
          updatedAt: { type: "timestamptz" },
        },
        relatedTables: ["contact_groups", "contact_group_members"],
      };

      return {
        contents: [{
          uri: "outreachos://resources/contact-schema",
          text: JSON.stringify(schema, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  // ────────────────────────────────────────────
  // 3. Recent Replies Summary
  // ────────────────────────────────────────────

  count++;
  server.resource(
    "recent_replies_summary",
    "outreachos://resources/recent-replies",
    { description: "Summary of recent inbox replies across all campaigns" },
    async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentReplies = await db
        .select({
          id: replies.id,
          contactId: replies.contactId,
          campaignId: replies.campaignId,
          subject: replies.subject,
          bodyPreview: replies.bodyPreview,
          receivedAt: replies.receivedAt,
        })
        .from(replies)
        .where(gte(replies.receivedAt, sevenDaysAgo))
        .orderBy(desc(replies.receivedAt))
        .limit(50);

      // Get contact names for the replies
      const enriched = [];
      for (const reply of recentReplies) {
        const [contact] = await db
          .select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
          .from(contacts)
          .where(eq(contacts.id, reply.contactId))
          .limit(1);

        enriched.push({
          ...reply,
          contactName: contact ? `${contact.firstName} ${contact.lastName}` : "Unknown",
          contactEmail: contact?.email ?? null,
        });
      }

      return {
        contents: [{
          uri: "outreachos://resources/recent-replies",
          text: JSON.stringify({
            totalReplies: enriched.length,
            period: "last_7_days",
            replies: enriched,
            generatedAt: new Date().toISOString(),
          }, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  // ────────────────────────────────────────────
  // 4. Experiment Status
  // ────────────────────────────────────────────

  count++;
  server.resource(
    "experiment_status",
    "outreachos://resources/experiment-status",
    { description: "Current status of all A/B test experiments" },
    async () => {
      const allExperiments = await db
        .select()
        .from(experiments)
        .orderBy(desc(experiments.createdAt))
        .limit(20);

      const summaries = [];
      for (const exp of allExperiments) {
        const batchList = await db
          .select()
          .from(experimentBatches)
          .where(eq(experimentBatches.experimentId, exp.id))
          .orderBy(desc(experimentBatches.batchNumber));

        summaries.push({
          id: exp.id,
          name: exp.name,
          type: exp.type,
          status: exp.status,
          championVariant: exp.championVariant,
          consecutiveWins: exp.consecutiveWins,
          totalBatches: batchList.length,
          latestBatch: batchList[0] ?? null,
        });
      }

      return {
        contents: [{
          uri: "outreachos://resources/experiment-status",
          text: JSON.stringify({
            experiments: summaries,
            generatedAt: new Date().toISOString(),
          }, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  return count;
}
