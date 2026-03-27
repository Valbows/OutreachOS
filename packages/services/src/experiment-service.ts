/**
 * ExperimentService — A/B test creation, batch orchestration, winner detection
 * Implemented in Phase 4
 */

import {
  db,
  experiments,
  experimentBatches,
  messageInstances,
  emailEvents,
} from "@outreachos/db";
import { eq, and, desc, sql, count } from "drizzle-orm";

const CONTACTS_PER_VARIANT = 20;
const MIN_BATCH_SIZE = 10; // Minimum contacts per variant for statistical significance
const SUBJECT_OPEN_RATE_THRESHOLD = 0.4; // 40% open rate to win
const CONSECUTIVE_WINS_REQUIRED = 2;

export type ExperimentType = "subject_line" | "body_cta";
export type ExperimentStatus = "active" | "champion_found" | "production";

export interface CreateExperimentInput {
  accountId: string;
  campaignId: string;
  name: string;
  type: ExperimentType;
  settings?: Record<string, unknown>;
}

export interface BatchResult {
  batchId: string;
  batchNumber: number;
  variantAOpenRate: number;
  variantBOpenRate: number;
  winner: "variant_a" | "variant_b" | "tie";
  rationale: string;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  type: ExperimentType;
  status: ExperimentStatus;
  totalBatches: number;
  championVariant: string | null;
  consecutiveWins: number;
}

export class ExperimentService {
  // === Experiment CRUD ===

  /** List experiments for an account */
  static async list(accountId: string) {
    return db
      .select()
      .from(experiments)
      .where(eq(experiments.accountId, accountId))
      .orderBy(desc(experiments.createdAt));
  }

  /** Get a single experiment by ID (scoped to account) */
  static async getById(accountId: string, experimentId: string) {
    const [experiment] = await db
      .select()
      .from(experiments)
      .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)))
      .limit(1);
    return experiment ?? null;
  }

  /** Create a new experiment */
  static async create(input: CreateExperimentInput) {
    const [experiment] = await db
      .insert(experiments)
      .values({
        accountId: input.accountId,
        campaignId: input.campaignId,
        name: input.name,
        type: input.type,
        status: "active",
        consecutiveWins: null, // Let DB apply default(0)
        settings: input.settings,
      })
      .returning();
    return experiment;
  }

  /** Delete an experiment */
  static async delete(accountId: string, experimentId: string) {
    await db
      .delete(experiments)
      .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)));
  }

  // === Batch Management ===

  /** Create a new batch for an experiment */
  static async createBatch(
    accountId: string,
    experimentId: string,
    variantA: string,
    variantB: string,
    contactsPerVariant: number = CONTACTS_PER_VARIANT,
  ) {
    return db.transaction(async (tx) => {
      // Lock the experiment row and verify ownership
      const [experiment] = await tx
        .select({ id: experiments.id })
        .from(experiments)
        .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)))
        .for("update");

      if (!experiment) {
        throw new Error("Experiment not found or not authorized");
      }

      // Determine next batch number (within transaction for atomicity)
      const existing = await tx
        .select()
        .from(experimentBatches)
        .where(eq(experimentBatches.experimentId, experimentId))
        .orderBy(desc(experimentBatches.batchNumber))
        .limit(1);

      const nextBatchNumber = existing.length > 0 ? existing[0].batchNumber + 1 : 1;

      const [batch] = await tx
        .insert(experimentBatches)
        .values({
          experimentId,
          batchNumber: nextBatchNumber,
          variantA,
          variantB,
          contactsPerVariant,
        })
        .returning();
      return batch;
    });
  }

  /** Get all batches for an experiment */
  static async getBatches(experimentId: string) {
    return db
      .select()
      .from(experimentBatches)
      .where(eq(experimentBatches.experimentId, experimentId))
      .orderBy(experimentBatches.batchNumber);
  }

  // === Evaluation ===

  /** Evaluate a batch by computing open rates from email events */
  static async evaluateBatch(batchId: string): Promise<BatchResult> {
    const [batch] = await db
      .select()
      .from(experimentBatches)
      .where(eq(experimentBatches.id, batchId))
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    // Get message instances for this batch, split by variant
    const messages = await db
      .select()
      .from(messageInstances)
      .where(eq(messageInstances.experimentBatchId, batchId));

    const variantAMessages = messages.filter((m) => m.subject === batch.variantA);
    const variantBMessages = messages.filter((m) => m.subject === batch.variantB);

    // Validate minimum sample size for statistical significance
    if (variantAMessages.length < MIN_BATCH_SIZE || variantBMessages.length < MIN_BATCH_SIZE) {
      throw new Error(
        `Insufficient sample size: each variant requires at least ${MIN_BATCH_SIZE} contacts. ` +
        `Variant A: ${variantAMessages.length}, Variant B: ${variantBMessages.length}`
      );
    }

    const variantAOpenRate = computeOpenRate(variantAMessages);
    const variantBOpenRate = computeOpenRate(variantBMessages);

    // Determine winner
    let winner: "variant_a" | "variant_b" | "tie";
    let rationale: string;

    if (variantAOpenRate >= SUBJECT_OPEN_RATE_THRESHOLD && variantAOpenRate > variantBOpenRate) {
      winner = "variant_a";
      rationale = `Variant A open rate ${(variantAOpenRate * 100).toFixed(1)}% exceeds threshold and beats Variant B ${(variantBOpenRate * 100).toFixed(1)}%`;
    } else if (variantBOpenRate >= SUBJECT_OPEN_RATE_THRESHOLD && variantBOpenRate > variantAOpenRate) {
      winner = "variant_b";
      rationale = `Variant B open rate ${(variantBOpenRate * 100).toFixed(1)}% exceeds threshold and beats Variant A ${(variantAOpenRate * 100).toFixed(1)}%`;
    } else {
      winner = "tie";
      rationale = `Neither variant met the ${SUBJECT_OPEN_RATE_THRESHOLD * 100}% threshold. A: ${(variantAOpenRate * 100).toFixed(1)}%, B: ${(variantBOpenRate * 100).toFixed(1)}%`;
    }

    // Update batch with results
    await db
      .update(experimentBatches)
      .set({
        variantAOpenRate,
        variantBOpenRate,
        winner,
        decisionRationale: rationale,
        evaluatedAt: new Date(),
      })
      .where(eq(experimentBatches.id, batchId));

    return {
      batchId,
      batchNumber: batch.batchNumber,
      variantAOpenRate,
      variantBOpenRate,
      winner,
      rationale,
    };
  }

  /** Check if champion is found after evaluating a batch */
  static async checkForChampion(
    accountId: string,
    experimentId: string,
  ): Promise<{ championFound: boolean; champion?: string }> {
    const experiment = await ExperimentService.getById(accountId, experimentId);
    if (!experiment) throw new Error("Experiment not found");

    const batches = await ExperimentService.getBatches(experimentId);
    const evaluatedBatches = batches.filter((b) => b.evaluatedAt !== null);

    if (evaluatedBatches.length < CONSECUTIVE_WINS_REQUIRED) {
      return { championFound: false };
    }

    // Check the last N batches for consecutive wins by the same variant
    const recentBatches = evaluatedBatches.slice(-CONSECUTIVE_WINS_REQUIRED);
    const allSameWinner = recentBatches.every(
      (b) => b.winner !== "tie" && b.winner === recentBatches[0].winner,
    );

    if (allSameWinner && recentBatches[0].winner !== "tie") {
      const champion =
        recentBatches[0].winner === "variant_a"
          ? recentBatches[0].variantA
          : recentBatches[0].variantB;

      // Update experiment with champion
      await db
        .update(experiments)
        .set({
          status: "champion_found",
          championVariant: champion,
          consecutiveWins: CONSECUTIVE_WINS_REQUIRED,
          updatedAt: new Date(),
        })
        .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)));

      return { championFound: true, champion };
    }

    // Update consecutive wins count for tracking
    let consecutiveWins = 0;
    for (let i = evaluatedBatches.length - 1; i >= 0; i--) {
      const b = evaluatedBatches[i];
      if (
        b.winner === evaluatedBatches[evaluatedBatches.length - 1].winner &&
        b.winner !== "tie"
      ) {
        consecutiveWins++;
      } else {
        break;
      }
    }

    await db
      .update(experiments)
      .set({ consecutiveWins, updatedAt: new Date() })
      .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)));

    return { championFound: false };
  }

  /** Promote champion to production — lock subject/body */
  static async promoteChampion(accountId: string, experimentId: string) {
    const experiment = await ExperimentService.getById(accountId, experimentId);
    if (!experiment) throw new Error("Experiment not found");
    if (experiment.status !== "champion_found") {
      throw new Error("No champion found yet");
    }

    await db
      .update(experiments)
      .set({ status: "production", updatedAt: new Date() })
      .where(and(eq(experiments.id, experimentId), eq(experiments.accountId, accountId)));

    return experiment.championVariant;
  }

  /** Get experiment summary with batch stats */
  static async getSummary(accountId: string, experimentId: string): Promise<ExperimentSummary> {
    const experiment = await ExperimentService.getById(accountId, experimentId);
    if (!experiment) throw new Error("Experiment not found");

    const batches = await ExperimentService.getBatches(experimentId);

    return {
      id: experiment.id,
      name: experiment.name,
      type: experiment.type as ExperimentType,
      status: experiment.status as ExperimentStatus,
      totalBatches: batches.length,
      championVariant: experiment.championVariant,
      consecutiveWins: experiment.consecutiveWins ?? 0,
    };
  }
}

// === Helpers ===

/** Compute open rate from message instances — exported for testing */
export function computeOpenRate(
  messages: { openCount: number | null; status: string }[],
): number {
  if (messages.length === 0) return 0;
  const opened = messages.filter(
    (m) => (m.openCount ?? 0) > 0 || m.status === "opened" || m.status === "clicked",
  ).length;
  return opened / messages.length;
}
