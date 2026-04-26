"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<string>("Completing authentication...");

  useEffect(() => {
    // Check if this is a linking flow
    const params = new URLSearchParams(window.location.search);
    const isLinking = params.get("linking") === "true";
    const hasError = params.get("error");

    if (hasError) {
      setStatus(`Authentication failed: ${hasError}`);
      // Notify parent window of failure
      if (window.opener) {
        window.opener.postMessage(
          { type: "OAUTH_ERROR", error: hasError },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 3000);
      return;
    }

    if (isLinking && window.opener) {
      // Get session to extract the linked Google account email
      authClient.getSession()
        .then((session: any) => {
          const email = session?.data?.user?.email || session?.data?.email;
          console.log("[Callback] Session email:", email);
          setStatus("Authentication successful! Closing window...");
          window.opener.postMessage(
            { type: "OAUTH_COMPLETE", email },
            window.location.origin
          );
          setTimeout(() => window.close(), 500);
        })
        .catch((err: any) => {
          console.error("[Callback] Failed to get session:", err);
          setStatus("Authentication completed but could not get email.");
          window.opener.postMessage(
            { type: "OAUTH_COMPLETE" },
            window.location.origin
          );
          setTimeout(() => window.close(), 500);
        });
    } else {
      // Normal sign-in flow - redirect to dashboard
      setStatus("Redirecting...");
      window.location.href = "/dashboard";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-lg">{status}</div>
        <div className="text-sm text-gray-500">
          You can close this window if it doesn&apos;t close automatically.
        </div>
      </div>
    </div>
  );
}
