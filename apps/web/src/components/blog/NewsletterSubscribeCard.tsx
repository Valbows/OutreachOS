"use client";

import { useCallback, useEffect, useId, useRef, useState, FormEvent } from "react";

function Mail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

interface NewsletterSubscribeCardProps {
  variant?: "inline" | "card" | "modal";
  onClose?: () => void;
}

export function NewsletterSubscribeCard({ variant = "inline", onClose }: NewsletterSubscribeCardProps) {
  const emailInputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Subscription failed" }));
        throw new Error(data.error || "Failed to subscribe");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (variant === "inline") {
    return (
      <div className="relative rounded-2xl bg-surface-container-low p-8 lg:p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="relative grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-secondary mb-3">
              The Newsletter
            </p>
            <h3 className="text-3xl lg:text-4xl font-bold tracking-tight text-on-surface leading-tight">
              Join 10,000+ operators getting weekly outreach insights
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {status === "success" ? (
              <div className="flex items-center gap-3 rounded-xl bg-secondary/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-secondary" />
                <p className="text-sm text-on-surface">You&apos;re subscribed! Check your inbox.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <label htmlFor={`${emailInputId}-inline`} className="sr-only">
                    Email address
                  </label>
                  <input
                    id={`${emailInputId}-inline`}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    aria-label="Email address"
                    required
                    disabled={status === "loading"}
                    className="flex-1 rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="rounded-lg bg-gradient-to-br from-primary to-primary-container px-6 py-3 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Subscribe
                  </button>
                </div>
                <p
                  className={`font-mono text-xs ${
                    errorMessage ? "text-error font-medium" : "text-on-surface-variant"
                  }`}
                  role={errorMessage ? "alert" : undefined}
                  aria-live="polite"
                >
                  {errorMessage || "No spam. Unsubscribe anytime."}
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="rounded-2xl bg-surface-container-low p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="relative">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
            <Mail className="h-5 w-5 text-secondary" />
          </div>
          <h3 className="text-xl font-bold text-on-surface tracking-tight">
            Stay ahead of the curve
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Weekly insights on outreach, AI, and growth.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {status === "success" ? (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <p className="text-sm text-on-surface">Subscribed!</p>
              </div>
            ) : (
              <>
                <label htmlFor={`${emailInputId}-card`} className="sr-only">
                  Email address
                </label>
                <input
                  id={`${emailInputId}-card`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  aria-label="Email address"
                  required
                  disabled={status === "loading"}
                  className="w-full rounded-lg bg-surface-container-highest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Subscribe
                </button>
                <p
                  className={`font-mono text-xs text-center ${
                    errorMessage ? "text-error font-medium" : "text-on-surface-variant"
                  }`}
                  role={errorMessage ? "alert" : undefined}
                  aria-live="polite"
                >
                  {errorMessage || "No spam. Unsubscribe anytime."}
                </p>
              </>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Modal variant — delegates to a sub-component to safely scope hooks for
  // focus management, Escape key, and backdrop click handling.
  return (
    <ModalDialog
      onClose={onClose}
      emailInputId={`${emailInputId}-modal`}
      email={email}
      setEmail={setEmail}
      status={status}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Modal sub-component with Escape, backdrop click, and focus trap    */
/* ------------------------------------------------------------------ */

interface ModalDialogProps {
  onClose?: () => void;
  emailInputId: string;
  email: string;
  setEmail: (value: string) => void;
  status: "idle" | "loading" | "success" | "error";
  errorMessage: string;
  onSubmit: (e: FormEvent) => void;
}

function ModalDialog({
  onClose,
  emailInputId,
  email,
  setEmail,
  status,
  errorMessage,
  onSubmit,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Guard onClose so every internal call-site is safe
  const safeClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Capture the element focused before mount so we can restore it on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    // Move initial focus into the dialog (prefer email input)
    const t = window.setTimeout(() => emailInputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      // Restore focus on unmount
      previousFocusRef.current?.focus?.();
    };
  }, []);

  // Escape-to-close + focus trap (Tab / Shift+Tab cycle inside dialog)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        safeClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      // Collect all focusable elements inside the dialog
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [safeClose]);

  // Backdrop click — only close when the click originated on the backdrop itself,
  // not on bubbled events from the content container.
  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      safeClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${emailInputId}-title`}
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-surface-container-high p-8 shadow-[0_0_80px_-20px] shadow-primary/30"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            type="button"
            onClick={safeClose}
            className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            aria-label="Close"
          >
            ✕
          </button>
        )}
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20">
            <Mail className="h-6 w-6 text-secondary" />
          </div>
          <h3 id={`${emailInputId}-title`} className="text-2xl font-bold text-on-surface tracking-tight">
            Don&apos;t leave empty-handed
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Weekly tactics on cold outreach, AI automation, and deliverability.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {status === "success" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary/10 p-4">
              <CheckCircle2 className="h-5 w-5 text-secondary" />
              <p className="text-sm text-on-surface">You&apos;re in! Check your inbox.</p>
            </div>
          ) : (
            <>
              <label htmlFor={emailInputId} className="sr-only">
                Email address
              </label>
              <input
                ref={emailInputRef}
                id={emailInputId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address"
                required
                disabled={status === "loading"}
                className="w-full rounded-lg bg-surface-container-highest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-3 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Get the insights
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={safeClose}
                  className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  No thanks
                </button>
              )}
              <p
                className={`font-mono text-xs text-center ${
                  errorMessage ? "text-error font-medium" : "text-on-surface-variant"
                }`}
                role={errorMessage ? "alert" : undefined}
                aria-live="polite"
              >
                {errorMessage || "No spam. Unsubscribe anytime."}
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
