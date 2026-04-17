import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getAuthAccount } from "@/lib/auth/session";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/google/sync
 *
 * Syncs the Google/Gmail linked account from Neon Auth into the local
 * `accounts.gmailAddress` column after a successful OAuth connection.
 *
 * Design:
 * - Refresh tokens are NOT stored locally — Neon Auth is the source of truth
 *   and provides fresh access tokens via `auth.getAccessToken({ providerId })`
 *   when we need to send email.
 * - This endpoint only persists the user-facing `gmailAddress` for display
 *   and campaign "from" routing.
 *
 * Called by the Settings page on mount and after a successful `signIn.social`
 * redirect returns the user.
 *
 * Responses:
 * - 200 { linked: true, gmailAddress } — Google account linked; address stored
 * - 200 { linked: false }              — No Google account linked
 * - 401 { error: "Unauthorized" }      — No active session
 * - 500 { error, details? }            — Unexpected failure
 */
export async function POST() {
  try {
    const account = await getAuthAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ask Neon Auth which OAuth providers are linked to this user.
    const accountsResult = await auth.listAccounts();
    // Debug: console.log("[Gmail Sync] listAccounts result:", JSON.stringify(accountsResult, null, 2));

    // Gracefully handle listAccounts errors with no data
    if (accountsResult.error || !accountsResult.data) {
      if (accountsResult.error) {
        console.error("[Gmail Sync] listAccounts error:", accountsResult.error);
      }
      // Clear Gmail fields and return linked: false when no data available
      await db
        .update(accounts)
        .set({ gmailAddress: null, gmailRefreshToken: null, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
      return NextResponse.json({ linked: false, debug: { accountCount: 0 } });
    }

    const linkedAccounts = Array.isArray(accountsResult.data) ? accountsResult.data : [];
    console.log("[Gmail Sync] linkedAccounts count:", linkedAccounts.length);

    // Debug logging - full account structure for troubleshooting
    linkedAccounts.forEach((acc: unknown, idx: number) => {
      const account = acc as Record<string, unknown>;
      console.log(`[Gmail Sync] Account ${idx} full structure:`, JSON.stringify({
        providerId: account?.providerId,
        provider: account?.provider,
        id: account?.id,
        type: account?.type,
        email: account?.email,
        accountEmail: account?.accountEmail,
        userEmail: (account?.user as Record<string, unknown>)?.email,
      }));
    });

    // Try multiple possible provider identifiers
    const google = linkedAccounts.find((acc: unknown) => {
      const account = acc as Record<string, unknown>;
      const providerId = String(account?.providerId ?? "").toLowerCase();
      const provider = String(account?.provider ?? "").toLowerCase();
      const id = String(account?.id ?? "").toLowerCase();
      const type = String(account?.type ?? "").toLowerCase();

      return (
        providerId === "google" ||
        providerId === "google_oauth2" ||
        provider === "google" ||
        provider === "google_oauth2" ||
        id.includes("google") ||
        type === "google" ||
        type === "oauth" && providerId.includes("google")
      );
    });

    console.log("[Gmail Sync] Google account found:", !!google);

    if (!google) {
      // No Google account linked — clear stale Gmail fields unconditionally
      await db
        .update(accounts)
        .set({ gmailAddress: null, gmailRefreshToken: null, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
      // Sanitize accounts to only expose non-sensitive metadata
      const sanitizedAccounts = linkedAccounts.map((acc: unknown) => {
        const account = acc as Record<string, unknown>;
        return {
          provider: account?.provider || account?.providerId || "unknown",
          id: typeof account?.id === "string" ? account.id.slice(0, 8) + "..." : "unknown",
          emailMask: typeof account?.email === "string"
            ? account.email.replace(/(.{2}).*(@.*)/, "$1***$2")
            : undefined,
        };
      });
      return NextResponse.json({ linked: false, debug: { accountCount: linkedAccounts.length, accounts: sanitizedAccounts } });
    }

    // Prefer the OAuth-linked email; fall back to the session's primary email.
    const googleAccount = google as Record<string, unknown>;
    const userObj = googleAccount?.user as Record<string, unknown> | undefined;
    const gmailAddress =
      String(googleAccount?.email ?? "").trim() ||
      String(googleAccount?.accountEmail ?? "").trim() ||
      String(userObj?.email ?? "").trim() ||
      account.email;

    await db
      .update(accounts)
      .set({ gmailAddress, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    // Gmail successfully linked
    return NextResponse.json({ linked: true, gmailAddress, debug: { source: "google" } });
  } catch (error) {
    const err = error as Error;
    console.error("Google sync error:", err?.message, "\nStack:", err?.stack);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 },
    );
  }
}
