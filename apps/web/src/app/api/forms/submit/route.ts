import { NextRequest, NextResponse } from "next/server";
import { FormService, hashIpAddress } from "@outreachos/services";
import { db, formTemplates } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const submitSchema = z.object({
  formId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
});

/** Public form submission endpoint — no auth required */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Look up the form to get accountId for contact creation
    const [form] = await db
      .select({ accountId: formTemplates.accountId })
      .from(formTemplates)
      .where(eq(formTemplates.id, parsed.data.formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Extract and immediately hash the client IP — raw IP is never stored
    const forwardedFor = request.headers.get("x-forwarded-for");
    const rawIp = forwardedFor
      ? forwardedFor.split(",")[0]?.trim()
      : request.headers.get("x-real-ip") ?? undefined;
    const hashedIp = rawIp ? hashIpAddress(rawIp) : undefined;

    const result = await FormService.submit(
      {
        formId: parsed.data.formId,
        data: parsed.data.data,
        hashedIp,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
      form.accountId,
    );

    let automation: { enrolled: string[] } = { enrolled: [] };
    if (result.contactId) {
      try {
        automation = await FormService.processAutomation(
          form.accountId,
          parsed.data.formId,
          result.contactId,
        );
      } catch (automationError) {
        console.error("Form automation error:", {
          error: automationError,
          formId: parsed.data.formId,
          accountId: form.accountId,
          contactId: result.contactId,
        });
      }
    }

    return NextResponse.json(
      { data: { ...result, automation } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Form submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
