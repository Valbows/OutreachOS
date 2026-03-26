"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Badge, Input, Switch } from "@/components/ui";

type EnrichmentStatus = "idle" | "running" | "done" | "error";

interface EnrichmentProgress {
  processed: number;
  total: number;
  found: number;
  verified: number;
}

export default function EnrichContactsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<EnrichmentStatus>("idle");
  const [progress, setProgress] = useState<EnrichmentProgress>({
    processed: 0,
    total: 0,
    found: 0,
    verified: 0,
  });
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [retrieveLinkedIn, setRetrieveLinkedIn] = useState(true);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [hunterKey, setHunterKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startEnrichment() {
    setStatus("running");
    setError(null);
    try {
      const res = await fetch("/api/enrichment/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidenceThreshold,
          retrieveLinkedIn,
          hunterApiKey: useOwnKey ? hunterKey : undefined,
        }),
      });

      if (!res.ok) {
        let errorMessage = "Enrichment failed.";
        try {
          const data = await res.json();
          errorMessage = data.error || `Server error: ${res.status}`;
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText}`;
        }
        setError(errorMessage);
        setStatus("error");
        return;
      }

      // SSE-style polling via ReadableStream or fallback polling
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let done = false;
        let hadError = false;
        let buffer = "";
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (potentially partial) segment in buffer
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line) continue;
              try {
                const data = JSON.parse(line);
                if (data.progress) {
                  setProgress(data.progress);
                }
                if (data.done) {
                  setProgress(data.progress);
                  setStatus("done");
                }
                if (data.error) {
                  setError(data.error);
                  setStatus("error");
                  hadError = true;
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          }
        }
        // Flush any remaining complete line in buffer
        if (buffer) {
          try {
            const data = JSON.parse(buffer);
            if (data.progress) {
              setProgress(data.progress);
            }
            if (data.done) {
              setProgress(data.progress);
              setStatus("done");
            }
            if (data.error) {
              setError(data.error);
              setStatus("error");
              hadError = true;
            }
          } catch {
            // ignore non-JSON lines
          }
        }
        if (!hadError) setStatus("done");
      } else {
        const data = await res.json();
        setProgress(data.progress);
        setStatus("done");
      }
    } catch {
      setError("Enrichment failed. Please check your connection and try again.");
      setStatus("error");
    }
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-primary mb-2">
          Enrichment — Step 2
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Find &amp; Verify Emails
        </h1>
        <p className="text-sm text-on-surface-variant">
          Leverage Hunter.io integration to automatically discover professional email
          addresses and verify their deliverability in real-time.
        </p>
      </div>

      {/* Done Banner */}
      {status === "done" && (
        <Card className="mb-6 border border-secondary/20">
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center">
                <CheckIcon />
              </div>
              <div className="flex-1">
                <p className="font-medium text-on-surface">
                  Enrichment complete — {progress.found} emails found, {progress.verified} verified
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {progress.processed} of {progress.total} contacts processed
                </p>
              </div>
              <Button size="sm" onClick={() => router.push("/contacts")}>
                View Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <div role="alert" className="mb-6 px-4 py-3 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-sm text-error">
          {error}
        </div>
      )}

      {/* Configuration */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-sm font-mono uppercase tracking-wider text-on-surface-variant mb-6">
            Enrichment Configuration
          </h2>

          {/* Confidence threshold */}
          <div className="mb-6">
            <label htmlFor="confidence" className="block text-sm font-medium text-on-surface mb-2">
              Confidence Threshold
            </label>
            <div className="flex items-center gap-4">
              <input
                id="confidence"
                type="range"
                min={50}
                max={100}
                step={5}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                disabled={status === "running"}
                className="flex-1 accent-primary"
              />
              <Badge variant={confidenceThreshold >= 80 ? "success" : "warning"}>
                {confidenceThreshold}%
              </Badge>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Higher thresholds ensure better deliverability but may return fewer results.
            </p>
          </div>

          {/* Toggle options */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">Retrieve LinkedIn URLs</p>
                <p className="text-xs text-on-surface-variant">
                  Find matching social profiles for all contacts
                </p>
              </div>
              <Switch
                checked={retrieveLinkedIn}
                onCheckedChange={setRetrieveLinkedIn}
                disabled={status === "running"}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">Use my Hunter.io key</p>
                <p className="text-xs text-on-surface-variant">
                  Save platform credits by using your own API key
                </p>
              </div>
              <Switch
                checked={useOwnKey}
                onCheckedChange={setUseOwnKey}
                disabled={status === "running"}
              />
            </div>
          </div>

          {/* BYOK Hunter key input */}
          {useOwnKey && (
            <div className="mb-6">
              <Input
                label="Hunter.io API Key"
                type="password"
                placeholder="Enter your API key"
                value={hunterKey}
                onChange={(e) => setHunterKey(e.target.value)}
                disabled={status === "running"}
              />
            </div>
          )}

          {/* Progress bar */}
          {status === "running" && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-on-surface">
                  Processing {progress.processed} of {progress.total}...
                </p>
                <span className="text-sm font-mono text-primary">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex gap-4 mt-3 text-xs text-on-surface-variant">
                <span>Found: <strong className="text-secondary">{progress.found}</strong></span>
                <span>Verified: <strong className="text-secondary">{progress.verified}</strong></span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            {status === "idle" || status === "error" ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/contacts")}
                >
                  Skip Enrichment
                </Button>
                <Button
                  onClick={startEnrichment}
                  disabled={useOwnKey && !hunterKey.trim()}
                >
                  Start Enrichment
                </Button>
              </>
            ) : status === "running" ? (
              <Button variant="secondary" disabled>
                <SpinnerIcon />
                Enriching...
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-secondary">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
    </svg>
  );
}
