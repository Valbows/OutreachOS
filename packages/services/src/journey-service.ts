/**
 * JourneyService — Multi-step email journey orchestration with state machine
 * Phase 5
 */

import {
  db,
  campaigns,
  campaignSteps,
  journeyEnrollments,
  messageInstances,
  contacts,
  templates,
} from "@outreachos/db";
import { eq, and, lte, isNull, asc, desc, count, sql, inArray } from "drizzle-orm";
import { TemplateService, type RenderContext } from "./template-service.js";
import { Resend } from "resend";

// Journey states (linear progression)
export const JOURNEY_STATES = [
  "enrolled",
  "initial_sent",
  "first_followup_sent",
  "second_followup_sent",
  "hail_mary_sent",
  "completed",
] as const;

export type JourneyState = (typeof JOURNEY_STATES)[number] | "removed";

// Step name → state after sending
export const STEP_STATE_MAP: Record<string, JourneyState> = {
  "Initial": "initial_sent",
  "1st Follow Up": "first_followup_sent",
  "2nd Follow Up": "second_followup_sent",
  "Hail Mary": "hail_mary_sent",
};

const DEFAULT_STEPS = [
  { stepNumber: 1, name: "Initial", delayDays: 0 },
  { stepNumber: 2, name: "1st Follow Up", delayDays: 3 },
  { stepNumber: 3, name: "2nd Follow Up", delayDays: 5 },
  { stepNumber: 4, name: "Hail Mary", delayDays: 7 },
];

export interface CreateJourneyInput {
  accountId: string;
  name: string;
  groupId?: string;
  steps?: Array<{
    name: string;
    templateId: string;
    delayDays: number;
    delayHour?: number;
  }>;
  removeOnReply?: boolean;
  removeOnUnsubscribe?: boolean;
}

export interface JourneyProgress {
  totalEnrolled: number;
  active: number;
  completed: number;
  removed: number;
  byStep: Record<string, number>;
}

export interface SendConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export class JourneyService {
  // === Journey CRUD ===

  /** Create a journey campaign with steps */
  static async create(input: CreateJourneyInput) {
    if (!input.accountId.trim() || !input.name.trim()) {
      throw new Error("Invalid journey input");
    }

    return db.transaction(async (tx) => {
      const [journeyCampaign] = await tx
        .insert(campaigns)
        .values({
          accountId: input.accountId,
          name: input.name,
          type: "journey",
          status: "draft",
          groupId: input.groupId ?? null,
          settings: {
            removeOnReply: input.removeOnReply ?? true,
            removeOnUnsubscribe: input.removeOnUnsubscribe ?? true,
          },
        })
        .returning();

      const stepsInput = input.steps ?? DEFAULT_STEPS.map((s) => ({
        name: s.name,
        templateId: "",
        delayDays: s.delayDays,
        delayHour: undefined as number | undefined,
      }));

      // Build batch insert array for all steps
      const stepsToInsert = stepsInput.map((step, i) => ({
        campaignId: journeyCampaign.id,
        stepNumber: i + 1,
        name: step.name,
        templateId: step.templateId || null,
        delayDays: step.delayDays,
        delayHour: step.delayHour ?? null,
      }));

      if (stepsToInsert.length > 0) {
        await tx.insert(campaignSteps).values(stepsToInsert);
      }

      return journeyCampaign;
    });
  }

  /** Get journey with steps */
  static async getById(accountId: string, journeyId: string) {
    const [journey] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, journeyId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
        ),
      )
      .limit(1);

    if (!journey) return null;

    const steps = await db
      .select()
      .from(campaignSteps)
      .where(eq(campaignSteps.campaignId, journeyId))
      .orderBy(asc(campaignSteps.stepNumber));

    return { ...journey, steps };
  }

  /** List journeys for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
        ),
      )
      .orderBy(desc(campaigns.createdAt));
  }

  /** Update a journey step */
  static async updateStep(
    accountId: string,
    journeyId: string,
    stepId: string,
    data: { templateId?: string; delayDays?: number; delayHour?: number | null },
  ) {
    // Verify step belongs to the specified journey and account
    const [stepOwned] = await db
      .select({ id: campaignSteps.id })
      .from(campaignSteps)
      .innerJoin(campaigns, eq(campaignSteps.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignSteps.id, stepId),
          eq(campaignSteps.campaignId, journeyId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
        ),
      )
      .limit(1);

    if (!stepOwned) {
      return null; // Step not found or doesn't belong to this journey/account
    }

    const [updated] = await db
      .update(campaignSteps)
      .set(data)
      .where(eq(campaignSteps.id, stepId))
      .returning();
    return updated;
  }

  /** Add a new step to a journey */
  static async addStep(
    accountId: string,
    journeyId: string,
    data: { name: string; templateId?: string; delayDays: number; delayHour?: number | null },
  ) {
    // Validate input
    if (!data.name.trim() || typeof data.delayDays !== "number" || data.delayDays < 0) {
      throw new Error("Invalid journey input");
    }

    // Verify journey ownership
    const [journey] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, journeyId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
        ),
      )
      .limit(1);

    if (!journey) {
      throw new Error("Journey not found");
    }

    // Atomic transaction: get max step number and insert in one go
    return db.transaction(async (tx) => {
      // Get current max step number (within transaction for isolation)
      const [maxStep] = await tx
        .select({ maxNumber: sql<number>`COALESCE(MAX(${campaignSteps.stepNumber}), 0)` })
        .from(campaignSteps)
        .where(eq(campaignSteps.campaignId, journeyId));

      const [newStep] = await tx
        .insert(campaignSteps)
        .values({
          campaignId: journeyId,
          stepNumber: (maxStep?.maxNumber ?? 0) + 1,
          name: data.name,
          templateId: data.templateId ?? null,
          delayDays: data.delayDays,
          delayHour: data.delayHour ?? null,
        })
        .returning();

      return newStep;
    });
  }

  /** Delete a step from a journey and renumber remaining steps */
  static async deleteStep(accountId: string, journeyId: string, stepId: string) {
    // Verify step ownership through journey
    const [stepOwned] = await db
      .select({ id: campaignSteps.id, stepNumber: campaignSteps.stepNumber })
      .from(campaignSteps)
      .innerJoin(campaigns, eq(campaignSteps.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.id, journeyId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
          eq(campaignSteps.id, stepId),
        ),
      )
      .limit(1);

    if (!stepOwned) {
      throw new Error("Step not found");
    }

    return db.transaction(async (tx) => {
      // Find the next step to reassign enrollments (if any)
      const [nextStep] = await tx
        .select({ id: campaignSteps.id, stepNumber: campaignSteps.stepNumber })
        .from(campaignSteps)
        .where(
          and(
            eq(campaignSteps.campaignId, journeyId),
            sql`${campaignSteps.stepNumber} > ${stepOwned.stepNumber}`,
          ),
        )
        .orderBy(asc(campaignSteps.stepNumber))
        .limit(1);

      // Reassign enrollments from deleted step to next step (or mark completed)
      const enrollmentsAtStep = await tx
        .select({ id: journeyEnrollments.id, status: journeyEnrollments.status })
        .from(journeyEnrollments)
        .where(
          and(
            eq(journeyEnrollments.campaignId, journeyId),
            eq(journeyEnrollments.currentStepId, stepId),
          ),
        );

      for (const enrollment of enrollmentsAtStep) {
        if (nextStep) {
          // Move enrollment to next step, recalculate nextSendAt
          await tx
            .update(journeyEnrollments)
            .set({
              currentStepId: nextStep.id,
              status: "enrolled",
              nextSendAt: sql`NOW() + INTERVAL '1 day' * ${nextStep.stepNumber - stepOwned.stepNumber}`,
              updatedAt: new Date(),
            })
            .where(eq(journeyEnrollments.id, enrollment.id));
        } else {
          // No next step - mark as completed
          await tx
            .update(journeyEnrollments)
            .set({
              status: "completed",
              currentStepId: null,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(journeyEnrollments.id, enrollment.id));
        }
      }

      // Delete the step
      await tx.delete(campaignSteps).where(eq(campaignSteps.id, stepId));

      // Renumber remaining steps
      const remainingSteps = await tx
        .select({ id: campaignSteps.id, stepNumber: campaignSteps.stepNumber })
        .from(campaignSteps)
        .where(eq(campaignSteps.campaignId, journeyId))
        .orderBy(asc(campaignSteps.stepNumber));

      for (let i = 0; i < remainingSteps.length; i++) {
        if (remainingSteps[i].stepNumber !== i + 1) {
          await tx
            .update(campaignSteps)
            .set({ stepNumber: i + 1 })
            .where(eq(campaignSteps.id, remainingSteps[i].id));
        }
      }

      return { deleted: true, reassignedCount: enrollmentsAtStep.length };
    });
  }

  /** Delete a journey and cascade enrollments */
  static async delete(accountId: string, journeyId: string) {
    await db
      .delete(campaigns)
      .where(
        and(
          eq(campaigns.id, journeyId),
          eq(campaigns.accountId, accountId),
          eq(campaigns.type, "journey"),
        ),
      );
  }

  // === Enrollment ===

  /** Enroll contacts from a group into a journey */
  static async enrollGroup(
    journeyId: string,
    contactList: Array<{ id: string }>,
    options?: { removeOnReply?: boolean; removeOnUnsubscribe?: boolean },
  ) {
    const steps = await db
      .select()
      .from(campaignSteps)
      .where(eq(campaignSteps.campaignId, journeyId))
      .orderBy(asc(campaignSteps.stepNumber));

    if (steps.length === 0) {
      throw new Error("Journey has no steps configured");
    }

    const firstStep = steps[0];
    const now = new Date();
    let enrolled = 0;

    for (const contact of contactList) {
      try {
        // Calculate initial send time
        const nextSendAt = JourneyService.calculateNextSend(
          now,
          firstStep.delayDays ?? 0,
          firstStep.delayHour ?? null,
        );

        await db.insert(journeyEnrollments).values({
          campaignId: journeyId,
          contactId: contact.id,
          currentStepId: firstStep.id,
          status: "enrolled",
          removeOnReply: options?.removeOnReply ?? true,
          removeOnUnsubscribe: options?.removeOnUnsubscribe ?? true,
          nextSendAt,
        });
        enrolled++;
      } catch (err) {
        // Check if this is a unique constraint violation (contact already enrolled)
        const isUniqueViolation =
          err instanceof Error &&
          ((err as { code?: string }).code === "23505" || // Postgres unique_violation
            (err as { constraint?: string }).constraint?.includes("unique"));

        if (isUniqueViolation) {
          // Silently skip — contact already enrolled
          continue;
        }

        // Log other errors (connection issues, timeouts, etc.) but don't fail the entire batch
        console.error(
          `Journey enrollment error for contact ${contact.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return { enrolled, skipped: contactList.length - enrolled };
  }

  /** Remove a contact from a journey */
  static async removeContact(
    journeyId: string,
    contactId: string,
    reason: string = "manual",
  ) {
    await db
      .update(journeyEnrollments)
      .set({
        status: "removed",
        removedAt: new Date(),
        removeReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(journeyEnrollments.campaignId, journeyId),
          eq(journeyEnrollments.contactId, contactId),
        ),
      );
  }

  // === Journey Processing (Cron Worker) ===

  /** Process due journey sends — called by Vercel Cron every 5 minutes */
  static async processDueSends(config: {
    resendApiKey: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
  }): Promise<{
    processed: number;
    sent: number;
    failed: number;
    completed: number;
    removed: number;
  }> {
    const now = new Date();
    const stats = { processed: 0, sent: 0, failed: 0, completed: 0, removed: 0 };

    // Atomically claim due enrollments using FOR UPDATE SKIP LOCKED
    // This prevents concurrent workers from processing the same rows
    const claimedIds = await db.transaction(async (tx) => {
      const dueEnrollments = await tx
        .select({ id: journeyEnrollments.id })
        .from(journeyEnrollments)
        .where(
          and(
            lte(journeyEnrollments.nextSendAt, now),
            isNull(journeyEnrollments.completedAt),
            isNull(journeyEnrollments.removedAt),
            isNull(journeyEnrollments.processingAt), // Not currently being processed
          ),
        )
        .for("update", { skipLocked: true }) // Skip rows locked by other workers
        .limit(100);

      const ids = dueEnrollments.map((e) => e.id);

      // Mark these enrollments as being processed
      if (ids.length > 0) {
        await tx
          .update(journeyEnrollments)
          .set({ processingAt: now })
          .where(inArray(journeyEnrollments.id, ids));
      }

      return ids;
    });

    if (claimedIds.length === 0) {
      return stats;
    }

    // Fetch full enrollment data for claimed rows (outside transaction)
    const dueEnrollments = await db
      .select()
      .from(journeyEnrollments)
      .where(inArray(journeyEnrollments.id, claimedIds));

    const resend = new Resend(config.resendApiKey);

    for (const enrollment of dueEnrollments) {
      stats.processed++;

      try {
        // Check auto-removal conditions before sending
        const shouldRemove = await JourneyService.checkRemovalConditions(enrollment);
        if (shouldRemove) {
          await JourneyService.removeContact(
            enrollment.campaignId,
            enrollment.contactId,
            shouldRemove,
          );
          stats.removed++;
          continue;
        }

        // Get the current step
        if (!enrollment.currentStepId) {
          stats.failed++;
          continue;
        }

        const [step] = await db
          .select()
          .from(campaignSteps)
          .where(eq(campaignSteps.id, enrollment.currentStepId))
          .limit(1);

        if (!step || !step.templateId) {
          stats.failed++;
          continue;
        }

        // Get template and contact
        const [template] = await db
          .select()
          .from(templates)
          .where(eq(templates.id, step.templateId))
          .limit(1);

        const [contact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, enrollment.contactId))
          .limit(1);

        if (!template || !contact) {
          stats.failed++;
          continue;
        }

        // Validate contact has an email before attempting to send
        if (!contact.email) {
          console.warn(`Skipping enrollment ${enrollment.id}: contact ${contact.id} has no email`);
          stats.failed++;
          continue;
        }

        // Render and send
        const context: RenderContext = {
          firstName: contact.firstName ?? undefined,
          lastName: contact.lastName ?? undefined,
          companyName: contact.companyName ?? undefined,
          businessWebsite: contact.businessWebsite ?? undefined,
          city: contact.city ?? undefined,
          state: contact.state ?? undefined,
          email: contact.email ?? undefined,
        };
        const fallbacks = (template.tokenFallbacks ?? {}) as Record<string, string>;
        const renderedSubject = TemplateService.renderSubject(
          template.subject ?? "",
          context,
          fallbacks,
        );
        const renderedHtml = TemplateService.render(
          template.bodyHtml ?? "",
          context,
          fallbacks,
        );

        const result = await resend.emails.send({
          from: config.fromName
            ? `${config.fromName} <${config.fromEmail}>`
            : config.fromEmail,
          to: contact.email,
          subject: renderedSubject,
          html: renderedHtml,
          replyTo: config.replyTo,
        });

        // Record message instance
        await db.insert(messageInstances).values({
          campaignId: enrollment.campaignId,
          contactId: contact.id,
          stepId: step.id,
          templateId: template.id,
          resendMessageId: result.data?.id ?? null,
          subject: renderedSubject,
          status: "sent",
          sentAt: new Date(),
        });

        // Advance to next step
        await JourneyService.advanceEnrollment(enrollment, step);
        stats.sent++;
      } catch (err) {
        console.error("Journey send error:", err);
        stats.failed++;
      } finally {
        // Always clear the processing lock, regardless of success or failure
        // Wrap in try-catch so failures are logged but don't break the loop
        try {
          await db
            .update(journeyEnrollments)
            .set({ processingAt: null })
            .where(eq(journeyEnrollments.id, enrollment.id));
        } catch (cleanupErr) {
          console.error(
            `Failed to clear processingAt for enrollment ${enrollment.id}:`,
            cleanupErr
          );
        }
      }
    }

    return stats;
  }

  /** Advance enrollment to the next step or complete */
  private static async advanceEnrollment(
    enrollment: typeof journeyEnrollments.$inferSelect,
    currentStep: typeof campaignSteps.$inferSelect,
  ) {
    // Get all steps for this journey
    const steps = await db
      .select()
      .from(campaignSteps)
      .where(eq(campaignSteps.campaignId, enrollment.campaignId))
      .orderBy(asc(campaignSteps.stepNumber));

    const currentIndex = steps.findIndex((s) => s.id === currentStep.id);
    const nextStep = steps[currentIndex + 1];
    const newState = STEP_STATE_MAP[currentStep.name] ?? "enrolled";

    if (nextStep) {
      // Move to next step
      const nextSendAt = JourneyService.calculateNextSend(
        new Date(),
        nextStep.delayDays ?? 0,
        nextStep.delayHour ?? null,
      );

      await db
        .update(journeyEnrollments)
        .set({
          currentStepId: nextStep.id,
          status: newState,
          nextSendAt,
          updatedAt: new Date(),
        })
        .where(eq(journeyEnrollments.id, enrollment.id));
    } else {
      // Journey complete
      await db
        .update(journeyEnrollments)
        .set({
          status: "completed",
          completedAt: new Date(),
          nextSendAt: null,
          updatedAt: new Date(),
        })
        .where(eq(journeyEnrollments.id, enrollment.id));
    }
  }

  /** Check if enrollment should be auto-removed */
  private static async checkRemovalConditions(
    enrollment: typeof journeyEnrollments.$inferSelect,
  ): Promise<string | null> {
    const [contact] = await db
      .select({
        unsubscribed: contacts.unsubscribed,
        replied: contacts.replied,
      })
      .from(contacts)
      .where(eq(contacts.id, enrollment.contactId))
      .limit(1);

    if (!contact) return "contact_deleted";
    if (enrollment.removeOnUnsubscribe && contact.unsubscribed) return "unsubscribed";
    if (enrollment.removeOnReply && contact.replied) return "replied";

    return null;
  }

  // === Progress & Analytics ===

  /** Get journey progress stats */
  static async getProgress(journeyId: string): Promise<JourneyProgress> {
    const enrollments = await db
      .select({ status: journeyEnrollments.status })
      .from(journeyEnrollments)
      .where(eq(journeyEnrollments.campaignId, journeyId));

    const byStep: Record<string, number> = {};
    let active = 0;
    let completed = 0;
    let removed = 0;

    for (const e of enrollments) {
      byStep[e.status] = (byStep[e.status] ?? 0) + 1;
      if (e.status === "completed") completed++;
      else if (e.status === "removed") removed++;
      else active++;
    }

    return {
      totalEnrolled: enrollments.length,
      active,
      completed,
      removed,
      byStep,
    };
  }

  // === Helpers ===

  /** Calculate next send time based on delay days and optional hour */
  private static calculateNextSend(
    fromDate: Date,
    delayDays: number,
    delayHour: number | null,
  ): Date {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + delayDays);

    if (delayHour !== null) {
      next.setHours(delayHour, 0, 0, 0);
      // If the calculated time is in the past, push to next day
      if (next <= fromDate) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }
}
