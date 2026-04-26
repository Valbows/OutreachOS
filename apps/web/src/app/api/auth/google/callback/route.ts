import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, accounts } from "@outreachos/db";
import { eq } from "drizzle-orm";
import { CryptoService } from "@outreachos/services";

/**
 * Handles Google OAuth callback for Gmail linking
 * GET /api/auth/google/callback
 */
export async function GET(request: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!appUrl) {
      console.error("[Google OAuth] NEXT_PUBLIC_APP_URL is not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!googleClientId || !googleClientSecret) {
      const missing = [!googleClientId && "GOOGLE_CLIENT_ID", !googleClientSecret && "GOOGLE_CLIENT_SECRET"].filter(Boolean).join(", ");
      console.error(`[Google OAuth] Missing required env vars: ${missing}`);
      return NextResponse.redirect(`${appUrl}/settings?oauth_error=server_misconfiguration`);
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get("google_oauth_state")?.value;
    const userId = cookieStore.get("google_oauth_user_id")?.value;

    // Clear cookies immediately
    cookieStore.delete("google_oauth_state");
    cookieStore.delete("google_oauth_user_id");

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      console.error("[Google OAuth] Error from Google:", error);
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=${encodeURIComponent(error)}`
      );
    }

    // Validate state parameter (CSRF protection)
    if (!state || state !== storedState) {
      console.error("[Google OAuth] Invalid state parameter");
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=invalid_state`
      );
    }

    if (!code) {
      console.error("[Google OAuth] No authorization code received");
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=no_code`
      );
    }

    if (!userId) {
      console.error("[Google OAuth] No user ID found");
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=no_user`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Google OAuth] Token exchange failed:", errorData);
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    console.log("[Google OAuth] Token exchange successful, refresh_token:", !!refresh_token);
    console.log("[Google OAuth] About to store Gmail for userId:", userId);

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      console.error("[Google OAuth] Failed to get user info");
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=userinfo_failed`
      );
    }

    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
      console.error("[Google OAuth] userInfo response missing email");
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=email_missing`
      );
    }

    if (!userInfo.verified_email) {
      const domain = (userInfo.email as string).split("@")[1] ?? "unknown";
      console.error("[Google OAuth] Google account email is not verified; domain:", domain);
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=email_not_verified`
      );
    }

    const gmailAddress: string = userInfo.email;

    // Store tokens in database
    // userId is the Neon Auth ID (session.data.user.id), not the accounts.id
    // We need to look up by neonAuthId column
    console.log("[Google OAuth] Looking up account by neonAuthId:", userId);
    const [accountRecord] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.neonAuthId, userId))
      .limit(1);

    if (!accountRecord) {
      console.error("[Google OAuth] No account found with neonAuthId:", userId);
      return NextResponse.redirect(
        `${appUrl}/settings?oauth_error=account_not_found`
      );
    }

    console.log("[Google OAuth] Found account with id:", accountRecord.id, "for neonAuthId:", userId);
    const updateResult = await db
      .update(accounts)
      .set({
        gmailAddress: gmailAddress,
        gmailRefreshTokenEncrypted: refresh_token
          ? CryptoService.encrypt(refresh_token)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountRecord.id));

    console.log("[Google OAuth] Database update result:", updateResult);
    const maskedGmail = gmailAddress.replace(/(.{2}).*(@.*)/, "$1***$2");
    console.log("[Google OAuth] Successfully linked Gmail:", maskedGmail, "for account:", accountRecord.id);

    // Redirect to a simple close page instead of full Settings page
    // This prevents the popup from loading the entire Settings page
    return NextResponse.redirect(
      `${appUrl}/api/auth/google/close?gmail_connected=true&gmail_email=${encodeURIComponent(gmailAddress)}`
    );
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${fallbackUrl}/settings?oauth_error=server_error`
    );
  }
}
