import { NextRequest, NextResponse } from "next/server";
import { getAuthAccount } from "@/lib/auth/session";
import { LLMService } from "@outreachos/services";
import { z } from "zod";

const generateSchema = z.object({
  goal: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  cta: z.string().optional(),
  maxWords: z.number().int().min(50).max(500).optional(),
  additionalInstructions: z.string().optional(),
});

const subjectSchema = z.object({
  emailBody: z.string().min(1),
  tone: z.string().min(1),
  maxWords: z.number().int().min(3).max(12).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

const rewriteSchema = z.object({
  currentBody: z.string().min(1),
  instruction: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
      }
      throw err;
    }
    const action = typeof body === "object" && body !== null && "action" in body
      ? (body as Record<string, unknown>).action as string
      : undefined;

    const config = { apiKey: geminiApiKey };

    switch (action) {
      case "generate_email": {
        const parsed = generateSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const result = await LLMService.generateEmail(account.id, config, parsed.data);
        return NextResponse.json({ data: result });
      }

      case "generate_subjects": {
        const parsed = subjectSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const result = await LLMService.generateSubjectLines(account.id, config, parsed.data);
        return NextResponse.json({ data: result });
      }

      case "rewrite": {
        const parsed = rewriteSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const result = await LLMService.rewriteEmail(
          account.id,
          config,
          parsed.data.currentBody,
          parsed.data.instruction,
        );
        return NextResponse.json({ data: result });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: generate_email, generate_subjects, rewrite" },
          { status: 400 },
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Template generate error:", errorMessage, error);
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 },
    );
  }
}
