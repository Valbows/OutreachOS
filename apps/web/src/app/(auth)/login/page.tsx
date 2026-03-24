"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { signInWithEmail } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);
  const [oauthPending, setOauthPending] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function handleOAuthSignIn(provider: "google" | "github") {
    setOauthPending(provider);
    setOauthError(null);
    try {
      await authClient.signIn.social({ provider });
    } catch (error) {
      setOauthPending(null);
      setOauthError(`Failed to sign in with ${provider === "google" ? "Google" : "GitHub"}. Please try again.`);
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-on-surface tracking-tight mb-2">
        Welcome back
      </h1>
      <p className="text-on-surface-variant mb-8">
        Enter your credentials to access your dashboard.
      </p>

      {/* OAuth providers */}
      <div className="flex flex-col gap-3 mb-6">
        {oauthError && (
          <div role="alert" className="px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
            {oauthError}
          </div>
        )}
        <button
          type="button"
          onClick={() => handleOAuthSignIn("google")}
          disabled={!!oauthPending}
          className="flex items-center justify-center gap-3 w-full px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-[var(--radius-button)] hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span className="text-sm font-medium">
            {oauthPending === "google" ? "Signing in..." : "Continue with Google"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuthSignIn("github")}
          disabled={!!oauthPending}
          className="flex items-center justify-center gap-3 w-full px-4 py-2.5 bg-surface-container-highest text-on-surface rounded-[var(--radius-button)] hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GitHubIcon />
          <span className="text-sm font-medium">
            {oauthPending === "github" ? "Signing in..." : "Continue with GitHub"}
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-outline-variant/30" />
        <span className="text-xs text-outline uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>

      {/* Email/Password form */}
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div role="alert" className="px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
            {state.error}
          </div>
        )}

        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:text-primary-fixed-dim transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-primary font-medium hover:text-primary-fixed-dim transition-colors"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 98 96" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
    </svg>
  );
}
