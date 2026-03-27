"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCampaign } from "@/lib/hooks/use-campaigns";
import { useGenerateSubjects } from "@/lib/hooks/use-templates";

export default function ABTestSubjectPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { data: campaign } = useCampaign(campaignId);
  const generateMutation = useGenerateSubjects();

  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  async function handleGenerateSuggestions() {
    setGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateMutation.mutateAsync({
        emailBody: "Professional outreach email for business partnership",
        tone: "professional",
        maxWords: 6,
        count: 4,
      });
      // Parse JSON array from LLM response
      try {
        const subjects = JSON.parse(result.text);
        if (Array.isArray(subjects) && subjects.length >= 2) {
          setVariantA(subjects[0]);
          setVariantB(subjects[1]);
        }
      } catch {
        // Fallback — use raw text lines
        const lines = result.text.split("\n").filter((l: string) => l.trim());
        if (lines.length >= 2) {
          setVariantA(lines[0].replace(/^[\d.\-*"]+\s*/, "").replace(/"/g, ""));
          setVariantB(lines[1].replace(/^[\d.\-*"]+\s*/, "").replace(/"/g, ""));
        }
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  }

  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreateExperiment() {
    if (!variantA || !variantB) return;

    setCreateError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: `${campaign?.name ?? "Campaign"} — Subject Test`,
          type: "subject_line",
          settings: { variantA, variantB },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create experiment");
      }

      router.push(`/campaigns/${campaignId}/analytics`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create experiment");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        &larr; Back
      </button>

      <h1 className="text-2xl font-semibold tracking-tight mb-2">A/B Test: Subject Lines</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Enter two subject line variants. We&apos;ll send each to 20 contacts and track open rates. The winner needs &ge;40% open rate for 2 consecutive batches.
      </p>

      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {["Choose Group", "Subject Lines", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= 1
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {i < 1 ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium ${i <= 1 ? "text-on-surface" : "text-on-surface-variant"}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className={`h-0.5 w-8 ${i < 1 ? "bg-primary" : "bg-outline-variant"}`} />}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* AI Generation */}
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-on-surface">AI Subject Generator</div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Let AI suggest subject line variants (max 6 words each)
              </div>
            </div>
            <button
              onClick={handleGenerateSuggestions}
              disabled={generating}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
          {generationError && (
            <div className="mt-3 rounded-lg border border-error bg-error/5 px-3 py-2 text-xs text-error">
              {generationError}
            </div>
          )}
        </div>

        {/* Variant A */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface mb-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">A</span>
            Variant A
          </label>
          <input
            type="text"
            value={variantA}
            onChange={(e) => setVariantA(e.target.value)}
            placeholder="Enter subject line variant A..."
            maxLength={100}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-xs text-on-surface-variant mt-1">
            {variantA.split(/\s+/).filter(Boolean).length} / 6 words recommended
          </div>
        </div>

        {/* Variant B */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface mb-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-green-100 text-xs font-bold text-green-700">B</span>
            Variant B
          </label>
          <input
            type="text"
            value={variantB}
            onChange={(e) => setVariantB(e.target.value)}
            placeholder="Enter subject line variant B..."
            maxLength={100}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-xs text-on-surface-variant mt-1">
            {variantB.split(/\s+/).filter(Boolean).length} / 6 words recommended
          </div>
        </div>

        {/* Preview */}
        {(variantA || variantB) && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <div className="text-xs font-medium text-on-surface-variant mb-3">Preview</div>
            <div className="space-y-2">
              {variantA && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600">A:</span>
                  <span className="text-sm text-on-surface">{variantA}</span>
                </div>
              )}
              {variantB && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-green-600">B:</span>
                  <span className="text-sm text-on-surface">{variantB}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {createError && (
            <div className="mb-3 rounded-lg border border-error bg-error/5 px-4 py-2 text-sm text-error w-full">
              {createError}
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleCreateExperiment}
            disabled={!variantA || !variantB || creating}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Experiment"}
          </button>
        </div>
      </div>
    </div>
  );
}
