import { NextRequest, NextResponse } from "next/server";
import { InboxService } from "@outreachos/services";
import { db, accounts } from "@outreachos/db";
import { isNotNull, and } from "drizzle-orm";

/**
 * Vercel Cron endpoint — polls IMAP inboxes for replies
 * Schedule: every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret — fail closed: require secret in non-dev environments
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

    // Find all accounts with IMAP configured
    const configuredAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          isNotNull(accounts.imapHost),
          isNotNull(accounts.imapUser),
          isNotNull(accounts.imapPassword),
        ),
      );

    const results = [];

    for (const account of configuredAccounts) {
      try {
        const settings = (account.settings ?? {}) as Record<string, unknown>;
        const isGmail = String(account.imapHost ?? "").includes("gmail");
        const result = await InboxService.pollAndProcess(
          account.id,
          {
            host: account.imapHost!,
            port: account.imapPort ?? 993,
            user: account.imapUser!,
            password: account.imapPassword!,
            tls: true,
          },
          {
            isGmail,
            gmailLabel: isGmail ? (settings.gmailLabel as string) ?? "leads" : undefined,
            destinationFolder: !isGmail ? (settings.destinationFolder as string) ?? undefined : undefined,
          },
        );
        results.push({ accountId: account.id, ...result });
      } catch (err) {
        console.error(`IMAP poll error for account ${account.id}:`, err);
        results.push({ accountId: account.id, error: "poll_failed" });
      }
    }

    console.log("Inbox poll completed:", { accountsPolled: results.length });
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Inbox poll cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
