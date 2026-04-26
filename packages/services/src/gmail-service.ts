/**
 * Gmail Service for sending emails using Google OAuth tokens
 */

interface GmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class GmailService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Refresh the access token using a refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("[GmailService] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured");
        return null;
      }

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        console.error("[GmailService] Failed to refresh token:", await response.text());
        return null;
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error("[GmailService] Error refreshing token:", error);
      return null;
    }
  }

  /**
   * Strip CR/LF and other control characters from a header value to prevent
   * CRLF injection. Throws if the resulting value is empty.
   */
  private static sanitiseHeaderValue(value: string, field: string): string {
    // Remove all ASCII control chars (0x00-0x1F) including CR and LF
    const sanitised = value.replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (!sanitised) throw new Error(`[GmailService] Header field '${field}' is empty after sanitisation`);
    return sanitised;
  }

  /**
   * Validate that a value looks like a single RFC 5322 email address
   * (bare address or "Display Name <addr>" form). Rejects multiple addresses.
   */
  private static validateEmailAddress(value: string, field: string): string {
    const sanitised = GmailService.sanitiseHeaderValue(value, field);
    // Extract the addr-spec portion from optional display-name + angle-bracket wrapping
    const addrSpec = sanitised.replace(/^[^<]*<([^>]+)>\s*$/, "$1").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addrSpec)) {
      throw new Error(`[GmailService] Invalid email address in '${field}': ${addrSpec}`);
    }
    return sanitised;
  }

  /**
   * Send an email using Gmail API
   */
  async sendEmail(message: GmailMessage): Promise<SendEmailResult> {
    try {
      // Sanitise and validate header values to prevent CRLF injection
      const to = GmailService.validateEmailAddress(message.to, "to");
      const subject = GmailService.sanitiseHeaderValue(message.subject, "subject").slice(0, 998);
      const from = message.from ? GmailService.validateEmailAddress(message.from, "from") : null;

      // Create RFC 2822 formatted email
      const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        from ? `From: ${from}` : "",
        "MIME-Version: 1.0",
        message.html
          ? 'Content-Type: text/html; charset="UTF-8"'
          : 'Content-Type: text/plain; charset="UTF-8"',
        "",
        message.html || message.text,
      ].filter(Boolean);

      const email = emailLines.join("\r\n");

      // Base64 encode (URL safe)
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send via Gmail API
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encodedEmail }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[GmailService] Send failed:", errorData);
        return {
          success: false,
          error: `Gmail API error: ${response.status} - ${errorData}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      console.error("[GmailService] Error sending email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export type { GmailMessage, SendEmailResult };
