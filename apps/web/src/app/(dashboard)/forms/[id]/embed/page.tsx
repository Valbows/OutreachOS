"use client";

import { useParams } from "next/navigation";
import { useFormEmbedCodes } from "@/lib/hooks/use-forms";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function GetEmbedCodePage() {
  const { id } = useParams<{ id: string }>();
  const { data: embedCodes, isLoading, error } = useFormEmbedCodes(id);
  const [copied, setCopied] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function copyToClipboard(code: string, label: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(label);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Store new timeout in ref
      timeoutRef.current = setTimeout(() => {
        setCopied(null);
        timeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      // Optionally show user feedback that copy failed
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !embedCodes) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="text-sm font-medium text-on-surface mb-1">Failed to load embed codes</h3>
        <Link href="/forms" className="text-xs text-primary hover:underline">Back to Forms</Link>
      </div>
    );
  }

  const methods = [
    {
      label: "Hosted Link",
      description: "Direct link to a hosted version of your form. Share via email, social media, or link shorteners.",
      code: embedCodes.hosted,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      ),
    },
    {
      label: "iFrame Embed",
      description: "Embed as an iframe in any webpage. Works with all site builders and CMS platforms.",
      code: embedCodes.iframe,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      label: "JavaScript Widget",
      description: "Lightweight JS snippet that renders your form inline. Best performance and customization.",
      code: embedCodes.widget,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
        <Link href="/forms" className="hover:text-primary transition-colors">Forms</Link>
        <span>/</span>
        <Link href={`/forms/${id}/edit`} className="hover:text-primary transition-colors">Edit</Link>
        <span>/</span>
        <span>Embed</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-on-surface mb-6">Get Embed Code</h1>

      <div className="space-y-4">
        {methods.map((method) => (
          <div key={method.label} className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {method.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium text-on-surface">{method.label}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">{method.description}</p>
              </div>
            </div>
            <div className="relative">
              <pre className="rounded-lg bg-surface p-3 text-xs font-mono text-on-surface-variant overflow-x-auto whitespace-pre-wrap break-all border border-outline-variant">
                {method.code}
              </pre>
              <button
                onClick={() => copyToClipboard(method.code, method.label)}
                className="absolute top-2 right-2 rounded-md bg-surface-container px-2 py-1 text-[10px] font-medium text-on-surface-variant hover:text-primary transition-colors"
                aria-label={`Copy ${method.label} code`}
              >
                {copied === method.label ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
