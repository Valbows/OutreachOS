/**
 * FunnelService — Behavioral & form-based email funnels with entry conditions
 * Phase 5.5
 */

import {
  db,
  campaigns,
  campaignSteps,
  journeyEnrollments,
  funnelConditions,
  messageInstances,
  emailEvents,
  contacts,
  templates,
  replies,
} from "@outreachos/db";
import { eq, and, asc, desc, count, sql, inArray, isNotNull, lte } from "drizzle-orm";
import { TemplateService, type RenderContext } from "./template-service.js";
import { Resend } from "resend";

export type ConditionType = "did_not_open" | "opened_more_than" | "replied" | "filled_form";

export interface FunnelCondition {
  conditionType: ConditionType;
  referenceCampaignId?: string;
  referenceFormId?: string;
  threshold?: number;
}

export interface CreateFunnelInput {
  accountId: string;
  name: string;
  groupId?: string;
  conditions: FunnelCondition[];
  steps: Array<{
    name: string;
    templateId: string;
    delayDays: number;
    delayHour?: number;
  }>;
}

export interface FunnelSummary {
  id: string;
  name: string;
  status: string;
  conditions: FunnelCondition[];
  stepCount: number;
  enrolledCount: number;
}

export class FunnelService {
  // === Funnel CRUD ===

  /** Create a funnel campaign with conditions and steps */
  static async create(input: CreateFunnelInput) {
    return db.transaction(async (tx) => {
      const [funnel] = await tx
        .insert(campaigns)
        .values({
          accountId: input.accountId,
          name: input.name,
          type: "funnel",
          status: "draft",
          groupId: input.groupId ?? null,
        })
        .returning();

      // Insert entry conditions
      if (input.conditions.length > 0) {
        await tx.insert(funnelConditions).values(
          input.conditions.map((c) => ({
            campaignId: funnel.id,
            conditionType: c.conditionType,
            referenceCampaignId: c.referenceCampaignId ?? null,
            referenceFormId: c.referenceFormId ?? null,
            threshold: c.threshold ?? null,
          })),
        );
      }

      // Insert steps
      if (input.steps.length > 0) {
        await tx.insert(campaignSteps).values(
          input.steps.map((step, i) => ({
            campaignId: funnel.id,
            stepNumber: i + 1,
            name: step.name,
            templateId: step.templateId || null,
            delayDays: step.delayDays,
            delayHour: step.delayHour ?? null,
          })),
        );
      }

      return funnel;
    });
  }

  /** Get funnel with conditions and steps */
  static async getById(accountId: string, funnelId: string) {
    const [funnel] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, funnelId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "funnel"),
        ),
      )
      .limit(1);

    if (!funnel) return null;

    const [conditions, steps] = await Promise.all([
      db
        .select()
        .from(funnelConditions)
        .where(eq(funnelConditions.campaignId, funnelId)),
      db
        .select()
        .from(campaignSteps)
        .where(eq(campaignSteps.campaignId, funnelId))
        .orderBy(asc(campaignSteps.stepNumber)),
    ]);

    return { ...funnel, conditions, steps };
  }

  /** List funnels for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "funnel"),
        ),
      )
      .orderBy(desc(campaigns.createdAt));
  }

  /** Delete a funnel */
  static async delete(accountId: string, funnelId: string) {
    await db
      .delete(campaigns)
      .where(
        and(
          eq(campaigns.id, funnelId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "funnel"),
        ),
      );
  }

  // === Condition Evaluation ===

  /**
   * Evaluate entry conditions for a funnel against a group of contacts.
   * Returns contactIds that meet ALL conditions (AND logic).
   */
  static async evaluateConditions(
    accountId: string,
    funnelId: string,
    candidateContactIds: string[],
  ): Promise<string[]> {
    if (candidateContactIds.length === 0) return [];

    // Verify ownership and fetch conditions in one query
    const conditions = await db
      .select({
        id: funnelConditions.id,
        campaignId: funnelConditions.campaignId,
        conditionType: funnelConditions.conditionType,
        referenceCampaignId: funnelConditions.referenceCampaignId,
        referenceFormId: funnelConditions.referenceFormId,
        threshold: funnelConditions.threshold,
      })
      .from(funnelConditions)
      .innerJoin(campaigns, eq(funnelConditions.campaignId, campaigns.id))
      .where(
        and(
          eq(funnelConditions.campaignId, funnelId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "funnel"),
        ),
      );

    if (conditions.length === 0) return candidateContactIds;

    let eligible = new Set(candidateContactIds);

    for (const condition of conditions) {
      const conditionType = condition.conditionType as ConditionType;
      const matching = await FunnelService.evaluateSingleCondition(
        accountId,
        conditionType,
        condition.referenceCampaignId,
        condition.referenceFormId,
        condition.threshold,
        Array.from(eligible),
      );
      eligible = new Set(matching);
      if (eligible.size === 0) break;
    }

    return Array.from(eligible);
  }

  /** Evaluate a single condition against a list of contact IDs */
  private static async evaluateSingleCondition(
    _accountId: string,
    conditionType: ConditionType,
    referenceCampaignId: string | null,
    referenceFormId: string | null,
    threshold: number | null,
    contactIds: string[],
  ): Promise<string[]> {
    if (contactIds.length === 0) return [];

    switch (conditionType) {
      case "did_not_open": {
        if (!referenceCampaignId) return contactIds;
        // Find contacts who received the reference campaign but did NOT open
        const opened = await db
          .select({ contactId: messageInstances.contactId })
          .from(messageInstances)
          .where(
            and(
              eq(messageInstances.campaignId, referenceCampaignId),
              inArray(messageInstances.contactId, contactIds),
              sql`${messageInstances.openCount} > 0`,
            ),
          );
        const openedSet = new Set(opened.map((r) => r.contactId));
        return contactIds.filter((id) => !openedSet.has(id));
      }

      case "opened_more_than": {
        if (!referenceCampaignId) return contactIds;
        const minOpens = threshold ?? 5;
        const qualifying = await db
          .select({ contactId: messageInstances.contactId })
          .from(messageInstances)
          .where(
            and(
              eq(messageInstances.campaignId, referenceCampaignId),
              inArray(messageInstances.contactId, contactIds),
              sql`${messageInstances.openCount} > ${minOpens}`,
            ),
          );
        return qualifying.map((r) => r.contactId);
      }

      case "replied": {
        if (!referenceCampaignId) return contactIds;
        // Check for campaign-specific replies via the replies table
        const replied = await db
          .select({ contactId: replies.contactId })
          .from(replies)
          .where(
            and(
              eq(replies.campaignId, referenceCampaignId),
              inArray(replies.contactId, contactIds),
            ),
          )
          .groupBy(replies.contactId);
        return replied.map((r) => r.contactId);
      }

      case "filled_form": {
        if (!referenceFormId) return contactIds;
        // NOT IMPLEMENTED: Form-to-funnel enrollment logic is not yet implemented.
        // Returning empty array to prevent unexpected enrollments.
        console.warn(
          `[FunnelService] filled_form condition not implemented. ` +
          `referenceFormId=${referenceFormId}, contactIds.length=${contactIds.length}. ` +
          `Returning empty array to prevent unexpected enrollments.`
        );
        return [];
      }

      default:
        return contactIds;
    }
  }

  // === Enrollment ===

  /** Enroll qualifying contacts into a funnel */
  static async enrollQualifyingContacts(
    accountId: string,
    funnelId: string,
    contactIds: string[],
  ): Promise<{ enrolled: number; skipped: number }> {
    const eligible = await FunnelService.evaluateConditions(
      accountId,
      funnelId,
      contactIds,
    );

    const steps = await db
      .select()
      .from(campaignSteps)
      .where(eq(campaignSteps.campaignId, funnelId))
      .orderBy(asc(campaignSteps.stepNumber));

    if (steps.length === 0) {
      throw new Error("Funnel has no steps configured");
    }

    const firstStep = steps[0];
    const now = new Date();
    let enrolled = 0;
    let skippedDueToAlreadyEnrolled = 0;

    for (const contactId of eligible) {
      try {
        const nextSendAt = new Date(
          now.getTime() + (firstStep.delayDays ?? 0) * 86400000,
        );
        if (firstStep.delayHour != null) {
          nextSendAt.setUTCHours(firstStep.delayHour, 0, 0, 0);
        }
        // Roll forward by one day if the calculated time is in the past
        if (nextSendAt <= now) {
          nextSendAt.setTime(nextSendAt.getTime() + 86400000);
        }

        await db.insert(journeyEnrollments).values({
          campaignId: funnelId,
          contactId,
          currentStepId: firstStep.id,
          status: "enrolled",
          removeOnReply: true,
          removeOnUnsubscribe: true,
          nextSendAt,
        });
        enrolled++;
      } catch (err) {
        const isUnique =
          err instanceof Error &&
          ((err as { code?: string }).code === "23505" ||
            (err as { constraint?: string }).constraint?.includes("unique"));
        if (isUnique) {
          skippedDueToAlreadyEnrolled++;
          continue;
        }
        console.error(`Funnel enrollment error for contact ${contactId}:`, err);
      }
    }

    return { enrolled, skipped: skippedDueToAlreadyEnrolled };
  }

  /** Get funnel progress — enforces account ownership */
  static async getProgress(accountId: string, funnelId: string) {
    // Verify ownership by joining with campaigns table
    const enrollments = await db
      .select({
        status: journeyEnrollments.status,
        count: count(),
      })
      .from(journeyEnrollments)
      .innerJoin(campaigns, eq(journeyEnrollments.campaignId, campaigns.id))
      .where(
        and(
          eq(journeyEnrollments.campaignId, funnelId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "funnel"),
        ),
      )
      .groupBy(journeyEnrollments.status);

    const result: Record<string, number> = {};
    for (const row of enrollments) {
      result[row.status] = row.count;
    }

    return {
      totalEnrolled: Object.values(result).reduce((a, b) => a + b, 0),
      active: (result["enrolled"] ?? 0) + (result["initial_sent"] ?? 0) +
        (result["first_followup_sent"] ?? 0) + (result["second_followup_sent"] ?? 0),
      completed: result["completed"] ?? 0,
      removed: result["removed"] ?? 0,
      byStatus: result,
    };
  }
}
