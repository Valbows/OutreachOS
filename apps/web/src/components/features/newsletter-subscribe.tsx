"use client";

import { useState } from "react";

interface NewsletterSubscribeProps {
  accountId: string;
  heading?: string;
  description?: string;
  className?: string;
}

export function NewsletterSubscribe({
  accountId,
  heading = "Subscribe to our newsletter",
  description = "Get the latest tips and updates delivered to your inbox.",
  className = "",
}: NewsletterSubscribeProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() || undefined, accountId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Subscription failed");
      }

      setStatus("success");
      setEmail("");
      setFirstName("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className={`rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center ${className}`}>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-on-surface">You&apos;re subscribed!</h3>
        <p className="text-xs text-on-surface-variant mt-1">Check your inbox for updates.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-outline-variant bg-surface-container-low p-6 ${className}`}>
      <h3 className="text-sm font-medium text-on-surface mb-1">{heading}</h3>
      <p className="text-xs text-on-surface-variant mb-4">{description}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name (optional)"
            aria-label="First name"
            className="w-1/3 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email address"
            required
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "Subscribing..." : "Subscribe"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-xs text-error">{errorMsg}</p>
      )}
    </div>
  );
}
