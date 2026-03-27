"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateCampaign } from "@/lib/hooks/use-campaigns";
import { useContactGroups } from "@/lib/hooks/use-contacts";
import { useTemplates } from "@/lib/hooks/use-templates";

const CAMPAIGN_TYPES = [
  {
    value: "one_time",
    label: "One-Time Campaign",
    description: "Send a single email to a group of contacts",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "ab_test",
    label: "A/B Test",
    description: "Test subject lines with small batches, then send the winner",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "newsletter",
    label: "Newsletter",
    description: "Regular updates sent to your subscriber list",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2zM3 8h18M8 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

export default function NewCampaignPage() {
  const router = useRouter();
  const createMutation = useCreateCampaign();
  const { data: groups } = useContactGroups();
  const { data: templates } = useTemplates();

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name || !selectedType) return;

    setError(null);

    try {
      const result = await createMutation.mutateAsync({
        name,
        type: selectedType,
        groupId: groupId || undefined,
        templateId: templateId || undefined,
      });

      // Validate response shape before navigating
      const campaignId = result?.data?.id;
      if (!campaignId) {
        throw new Error("Invalid response: missing campaign ID");
      }

      if (selectedType === "ab_test") {
        router.push(`/campaigns/ab-test/setup?campaignId=${campaignId}`);
      } else {
        router.push(`/campaigns/${campaignId}/analytics`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/campaigns")}
        className="mb-4 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        &larr; Back to Campaigns
      </button>

      <h1 className="text-2xl font-semibold tracking-tight mb-2">Create Campaign</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Choose a campaign type and configure your settings.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {s}
            </div>
            {s < 2 && (
              <div className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-outline-variant"}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Select Campaign Type</h2>
          <div className="grid gap-3">
            {CAMPAIGN_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setSelectedType(type.value);
                  setStep(2);
                }}
                className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-primary ${
                  selectedType === type.value
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant bg-surface-container-low"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {type.icon}
                </div>
                <div>
                  <div className="font-medium text-on-surface">{type.label}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Campaign Details</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="campaign-name" className="block text-sm font-medium text-on-surface mb-1">Campaign Name</label>
              <input
                id="campaign-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 Outreach Blast"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="contact-group" className="block text-sm font-medium text-on-surface mb-1">Contact Group</label>
              <select
                id="contact-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All contacts</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="template-select" className="block text-sm font-medium text-on-surface mb-1">Template</label>
              <select
                id="template-select"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a template...</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              {error && (
                <div className="mb-3 rounded-lg border border-error bg-error/5 px-4 py-2 text-sm text-error w-full">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!name || createMutation.isPending}
                className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
