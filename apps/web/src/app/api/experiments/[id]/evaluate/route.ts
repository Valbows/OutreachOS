import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { ExperimentService } from "@outreachos/services";
import { db, experimentBatches, experiments } from "@outreachos/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const evaluateSchema = z.object({
  batchId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = evaluateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify batch belongs to this experiment before evaluating
    const { batchId } = parsed.data;
    const [batch] = await db
      .select({ experimentId: experimentBatches.experimentId })
      .from(experimentBatches)
      .where(eq(experimentBatches.id, batchId))
      .limit(1);

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.experimentId !== id) {
      return NextResponse.json({ error: "Batch does not belong to this experiment" }, { status: 403 });
    }

    // Verify experiment belongs to authenticated account
    const [experiment] = await db
      .select({ id: experiments.id })
      .from(experiments)
      .where(and(eq(experiments.id, id), eq(experiments.accountId, account.id)))
      .limit(1);

    if (!experiment) {
      return NextResponse.json({ error: "Experiment not found or not authorized" }, { status: 403 });
    }

    const batchResult = await ExperimentService.evaluateBatch(batchId);
    const championCheck = await ExperimentService.checkForChampion(account.id, id);

    return NextResponse.json({
      data: {
        batch: batchResult,
        champion: championCheck,
      },
    });
  } catch (error) {
    console.error("Experiment evaluate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
