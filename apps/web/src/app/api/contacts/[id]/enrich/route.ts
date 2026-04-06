/**
 * Re-enrichment API for a single contact
 * POST /api/contacts/[id]/enrich — re-enrich a single contact via Hunter.io
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { EnrichmentService, type EnrichmentConfig } from "@outreachos/services";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contactId } = await params;

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

    const result = await EnrichmentService.reEnrich(account.id, contactId, config);

    if (result.error) {
      // Distinguish between not-found and enrichment failure using errorCode
      if (result.errorCode === "NOT_FOUND") {
        return NextResponse.json({ error: result.error, contactId }, { status: 404 });
      }
      // Return 422 for enrichment failures (not a server error, but enrichment couldn't complete)
      return NextResponse.json(
        { success: false, error: result.error, contactId, errorCode: result.errorCode },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      contactId,
      email: result.email,
      score: result.score,
      status: result.status,
      linkedinUrl: result.linkedinUrl,
    });
  } catch (err) {
    console.error("Re-enrich contact error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
