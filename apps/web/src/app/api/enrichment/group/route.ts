/**
 * Re-enrichment API for a contact group
 * POST /api/enrichment/group — re-enrich all contacts in a group via Hunter.io
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { EnrichmentService, ContactService, type EnrichmentConfig, type BatchProgress } from "@outreachos/services";
import { z } from "zod";

const requestSchema = z.object({
  groupId: z.string().uuid(),
  forceReenrich: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Invalid JSON", details: parseErr instanceof Error ? parseErr.message : "Failed to parse request body" },
        { status: 400 }
      );
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { groupId, forceReenrich } = parsed.data;

    // Verify group exists and belongs to account
    const groups = await ContactService.listGroups(account.id);
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get Hunter API key from environment or BYOK
    const hunterApiKey = process.env.HUNTER_API_KEY;
    if (!hunterApiKey) {
      return NextResponse.json(
        { error: "Hunter.io API key not configured" },
        { status: 503 }
      );
    }

    const config: EnrichmentConfig = {
      hunterApiKey,
      confidenceThreshold: 80,
      retrieveLinkedIn: true,
    };

    // Stream progress updates via NDJSON
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (progress: BatchProgress) => {
          controller.enqueue(encoder.encode(JSON.stringify(progress) + "\n"));
        };

        try {
          let finalProgress: BatchProgress;

          if (forceReenrich) {
            // Re-enrich all contacts in the group (including already enriched)
            finalProgress = await EnrichmentService.reEnrichGroup(
              account.id,
              groupId,
              config,
              sendProgress
            );
          } else {
            // Only enrich unenriched contacts
            finalProgress = await EnrichmentService.batchEnrich(
              account.id,
              config,
              groupId,
              sendProgress
            );
          }

          // Send final result
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ done: true, ...finalProgress }) + "\n"
            )
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                error: err instanceof Error ? err.message : "Enrichment failed",
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Group re-enrich error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
