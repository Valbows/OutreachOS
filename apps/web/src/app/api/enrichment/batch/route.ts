import { NextRequest } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { EnrichmentService, type BatchProgress } from "@outreachos/services";

export async function POST(request: NextRequest) {
  const account = await getAuthAccount();
  if (!account) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy untyped JSON parse; TODO migrate to Zod
  let body: any;
  try {
    body = await request.json();
  } catch (parseErr) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const {
    confidenceThreshold,
    retrieveLinkedIn,
    hunterApiKey,
    groupId,
  } = body;

  // Resolve Hunter API key: BYOK or platform key
  const apiKey = hunterApiKey || process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "No Hunter.io API key configured. Add one in Settings or provide your own." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Stream progress via newline-delimited JSON
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const progress = await EnrichmentService.batchEnrich(
          account.id,
          {
            hunterApiKey: apiKey,
            confidenceThreshold: confidenceThreshold ?? 80,
            retrieveLinkedIn: retrieveLinkedIn ?? true,
          },
          groupId,
          (p: BatchProgress) => {
            controller.enqueue(
              encoder.encode(JSON.stringify({ progress: p }) + "\n"),
            );
          },
        );

        controller.enqueue(
          encoder.encode(JSON.stringify({ done: true, progress }) + "\n"),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Enrichment failed";
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: message }) + "\n"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
