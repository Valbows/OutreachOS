"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useContactGroups } from "@/lib/hooks/use-contacts";
import { useUpdateCampaign } from "@/lib/hooks/use-campaigns";

export default function ABTestSetupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <ABTestSetupContent />
    </Suspense>
  );
}

function ABTestSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? "";
  const { data: groups, isLoading, error: groupsError } = useContactGroups();
  const updateMutation = useUpdateCampaign();

  const [selectedGroup, setSelectedGroup] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle missing campaignId
  if (!campaignId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-error bg-error/5 p-8 text-center">
          <p className="text-sm text-error mb-3">Missing campaign ID.</p>
          <button
            onClick={() => router.push("/campaigns")}
            className="text-sm text-primary hover:underline"
          >
            Go to Campaigns
          </button>
        </div>
      </div>
    );
  }

  async function handleContinue() {
    if (!selectedGroup || !campaignId) return;

    setError(null);

    try {
      await updateMutation.mutateAsync({
        id: campaignId,
        groupId: selectedGroup,
      });
      router.push(`/campaigns/ab-test/${campaignId}/subject`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
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

      <h1 className="text-2xl font-semibold tracking-tight mb-2">A/B Test: Choose Group</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Select the contact group to use for your A/B subject line test. We&apos;ll send 20 contacts per variant per batch.
      </p>

      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {["Choose Group", "Subject Lines", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  i === 0
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs font-medium ${i === 0 ? "text-on-surface" : "text-on-surface-variant"}`}>
                {label}
              </span>
            </div>
            {i < 2 && <div className="h-0.5 w-8 bg-outline-variant" />}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : groupsError ? (
        <div className="rounded-xl border border-error bg-error/5 p-8 text-center">
          <p className="text-sm text-error mb-3">Failed to load contact groups.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !groups?.length ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface-variant mb-3">No contact groups found.</p>
          <button
            onClick={() => router.push("/contacts")}
            className="text-sm text-primary hover:underline"
          >
            Go to Contacts to create a group
          </button>
        </div>
      ) : (
        <div className="space-y-3" role="radiogroup" aria-label="Select contact group">
          {groups.map((group) => (
            <button
              key={group.id}
              role="radio"
              aria-checked={selectedGroup === group.id}
              aria-label={group.name}
              tabIndex={selectedGroup === group.id || selectedGroup === "" ? 0 : -1}
              onClick={() => setSelectedGroup(group.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedGroup(group.id);
                }
              }}
              className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                selectedGroup === group.id
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant bg-surface-container-low hover:border-primary/50"
              }`}
            >
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                selectedGroup === group.id ? "border-primary" : "border-outline-variant"
              }`}>
                {selectedGroup === group.id && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <div className="font-medium text-on-surface text-sm">{group.name}</div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  {group.description ?? "No description"}
                </div>
              </div>
            </button>
          ))}

          <div className="pt-4">
            {error && (
              <div className="mb-3 rounded-lg border border-error bg-error/5 px-4 py-2 text-sm text-error">
                {error}
              </div>
            )}
            <button
              onClick={handleContinue}
              disabled={!selectedGroup || updateMutation.isPending}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Continue to Subject Lines"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
