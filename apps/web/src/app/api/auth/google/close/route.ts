import { NextRequest, NextResponse } from "next/server";

/**
 * Simple close page for OAuth callback popup
 * GET /api/auth/google/close
 *
 * This page is displayed in the popup after successful OAuth.
 * It closes the popup and notifies the parent window via postMessage.
 */
/**
 * Escape a JSON string for safe embedding inside a <script> tag.
 * Prevents premature script-close via </script> and HTML comment injection via <!--.
 */
function safeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f");
}

/** Escape a string for safe interpolation inside an HTML text node or attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const gmailConnected = searchParams.get("gmail_connected") === "true";
  const gmailEmail = searchParams.get("gmail_email") || "";
  const error = searchParams.get("oauth_error");

  const safeError = error ? escapeHtml(error) : null;

  // Generate HTML that closes the window and notifies parent
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Callback</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .success {
      color: #10b981;
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    .error {
      color: #ef4444;
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    .message {
      color: #666;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    ${gmailConnected 
      ? '<div class="success">✓ Gmail Connected</div><div class="message">Your Gmail account has been successfully linked. This window will close automatically.</div>' 
      : safeError 
      ? `<div class="error">✗ Connection Failed</div><div class="message">Error: ${safeError}</div>` 
      : '<div class="message">Processing...</div>'
    }
  </div>
  <script>
    // Notify parent window of result
    if (window.opener) {
      window.opener.postMessage(${safeJsonForScript(JSON.stringify({
        type: "oauth_callback",
        success: gmailConnected,
        gmailEmail,
        error: error ?? "",
      }))}, window.location.origin);
    }
    
    // Close window after a short delay
    setTimeout(() => {
      window.close();
    }, 1000);
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
