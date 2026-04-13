import { NextRequest, NextResponse } from "next/server";
import { NewsletterService } from "@outreachos/services";
import { db, campaigns, accounts } from "@outreachos/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";

/**
 * Vercel Cron endpoint — processes scheduled newsletters
 * Schedule: every 15 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret && process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find due newsletters
    const dueNewsletters = await NewsletterService.getDueNewsletters();
    const results = [];

    for (const newsletter of dueNewsletters) {
      try {
        // Get account with send config
        const [account] = await db
          .select({
            id: accounts.id,
            senderDomain: accounts.senderDomain,
            smtpUser: accounts.smtpUser,
          })
          .from(accounts)
          .where(eq(accounts.id, newsletter.accountId))
          .limit(1);

        if (!account?.senderDomain) {
          results.push({
            campaignId: newsletter.id,
            error: "No sender domain configured",
          });
          continue;
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          results.push({
            campaignId: newsletter.id,
            error: "RESEND_API_KEY not configured",
          });
          continue;
        }

        const result = await NewsletterService.send(newsletter.accountId, newsletter.id, {
          resendApiKey,
          fromEmail: `newsletter@${account.senderDomain}`,
          fromName: "Newsletter",
        });

        results.push({
          campaignId: newsletter.id,
          ...result,
        });
      } catch (err) {
        console.error(`Newsletter send error for ${newsletter.id}:`, err);
        results.push({
          campaignId: newsletter.id,
          error: err instanceof Error ? err.message : "Send failed",
        });
      }
    }

    // Process recurring newsletters after sends complete
    let recurringResults = [];
    try {
      recurringResults = await NewsletterService.processRecurringNewsletters();
    } catch (recurringError) {
      console.error("Failed to process recurring newsletters:", recurringError);
      // Don't fail the whole cron job if recurring processing fails
    }

    return NextResponse.json({
      data: results,
      dueFound: dueNewsletters.length,
      recurringProcessed: recurringResults.length,
    });
  } catch (error) {
    console.error("Newsletter cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
