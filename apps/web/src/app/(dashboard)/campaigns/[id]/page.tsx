"use client";

import { useParams, useRouter } from "next/navigation";
import { useCampaign, useDeleteCampaign, useUpdateCampaign } from "@/lib/hooks/use-campaigns";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useState } from "react";

interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  done?: boolean;
  error?: string;
}

const TYPE_LABELS: Record<string, string> = {
  one_time: "One-Time",
  journey: "Journey",
  funnel: "Funnel",
  ab_test: "A/B Test",
  newsletter: "Newsletter",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-400",
  scheduled: "bg-blue-500/10 text-blue-400",
  running: "bg-amber-500/10 text-amber-400",
  paused: "bg-orange-500/10 text-orange-400",
  completed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: campaign, isLoading, error, refetch } = useCampaign(id);
  const deleteMutation = useDeleteCampaign();
  const updateMutation = useUpdateCampaign();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendCampaign = async () => {
    setIsSending(true);
    setSendProgress(null);
    setSendError(null);

    try {
      const response = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          const text = await response.text().catch(() => "");
          if (text) errorMessage = `${errorMessage} — ${text}`;
        }
        throw new Error(errorMessage);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        throw new Error("No response body");
      }

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const data: SendProgress = JSON.parse(line.slice(6));
          setSendProgress(data);
          if (data.done) {
            setIsSending(false);
            // Refresh campaign data to get updated status
            refetch();
          }
          if (data.error) {
            setSendError(data.error);
            setIsSending(false);
          }
        } catch {
          // Ignore parse errors
        }
      };

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Flush any remaining buffered line
          if (buffer) processLine(buffer);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) segment for the next chunk
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send campaign");
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="text-sm font-medium text-on-surface mb-1">Campaign not found</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          {error?.message ?? "The campaign you're looking for doesn't exist."}
        </p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const isNewsletter = campaign.type === "newsletter";
  const isJourney = campaign.type === "journey";
  const isFunnel = campaign.type === "funnel";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Link href="/campaigns" className="hover:text-primary transition-colors">Campaigns</Link>
        <span>/</span>
        <span className="text-on-surface truncate max-w-[200px]">{campaign.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{campaign.name}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            {TYPE_LABELS[campaign.type] ?? campaign.type} • Created {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isNewsletter && (
            <Link href={`/campaigns/${id}/analytics`}>
              <Button variant="secondary">View Analytics</Button>
            </Link>
          )}
          {isJourney && (
            <Link href={`/campaigns/journey/${id}`}>
              <Button variant="secondary">Edit Journey</Button>
            </Link>
          )}
          {isFunnel && (
            <Link href={`/campaigns/funnel/${id}`}>
              <Button variant="secondary">Edit Funnel</Button>
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-error hover:text-error"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
            <h2 className="text-sm font-medium text-on-surface mb-4">Campaign Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Status</label>
                <p className="text-sm text-on-surface capitalize">{campaign.status}</p>
              </div>
              <div>
                <label className="text-xs text-on-surface-variant block mb-1">Type</label>
                <p className="text-sm text-on-surface">{TYPE_LABELS[campaign.type] ?? campaign.type}</p>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Scheduled For</label>
                  <p className="text-sm text-on-surface">{new Date(campaign.scheduledAt).toLocaleString()}</p>
                </div>
              )}
              {campaign.groupId && (
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">Target Group</label>
                  <p className="text-sm text-on-surface">{campaign.groupId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Newsletter Content Preview */}
          {isNewsletter && !!campaign.settings?.templateId && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
              <h2 className="text-sm font-medium text-on-surface mb-4">Newsletter Content</h2>
              <div className="flex items-center justify-between">
                <p className="text-sm text-on-surface-variant">
                  Template: {String(campaign.settings.templateId)}
                </p>
                <Link href={`/templates/${String(campaign.settings.templateId)}/edit`}>
                  <Button variant="secondary" size="sm">Edit Template</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">Actions</h3>
            <div className="space-y-2">
              {/* Send Campaign Button - for draft/scheduled campaigns */}
              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                <>
                  <Button
                    className="w-full"
                    onClick={handleSendCampaign}
                    disabled={isSending}
                  >
                    {isSending ? "Sending..." : "Send Campaign"}
                  </Button>
                  {sendProgress && (
                    <div className="text-xs text-on-surface-variant">
                      Sent: {sendProgress.sent} / {sendProgress.total}
                      {sendProgress.failed > 0 && (
                        <span className="text-error ml-2">({sendProgress.failed} failed)</span>
                      )}
                    </div>
                  )}
                  {sendError && (
                    <div className="text-xs text-error">{sendError}</div>
                  )}
                </>
              )}
              {campaign.status === "draft" && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setStatusUpdateError(null);
                    try {
                      await updateMutation.mutateAsync({ id, status: "scheduled" });
                    } catch (err) {
                      console.error("Failed to schedule campaign:", err);
                      setStatusUpdateError("Failed to schedule campaign. Please try again.");
                    }
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Scheduling..." : "Schedule Campaign"}
                </Button>
              )}
              {campaign.status === "scheduled" && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setStatusUpdateError(null);
                    try {
                      await updateMutation.mutateAsync({ id, status: "draft" });
                    } catch (err) {
                      console.error("Failed to unschedule campaign:", err);
                      setStatusUpdateError("Failed to unschedule campaign. Please try again.");
                    }
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Unscheduling..." : "Unschedule"}
                </Button>
              )}
              {campaign.status === "running" && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setStatusUpdateError(null);
                    try {
                      await updateMutation.mutateAsync({ id, status: "paused" });
                    } catch (err) {
                      console.error("Failed to pause campaign:", err);
                      setStatusUpdateError("Failed to pause campaign. Please try again.");
                    }
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Pausing..." : "Pause"}
                </Button>
              )}
              {campaign.status === "paused" && (
                <Button
                  className="w-full"
                  onClick={async () => {
                    setStatusUpdateError(null);
                    try {
                      await updateMutation.mutateAsync({ id, status: "running" });
                    } catch (err) {
                      console.error("Failed to resume campaign:", err);
                      setStatusUpdateError("Failed to resume campaign. Please try again.");
                    }
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Resuming..." : "Resume"}
                </Button>
              )}
              {statusUpdateError && (
                <div className="text-sm text-error mt-2">{statusUpdateError}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-on-surface mb-2">Delete Campaign?</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              This will permanently delete &quot;{campaign.name}&quot;. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await deleteMutation.mutateAsync(id);
                    router.push("/campaigns");
                  } catch (err) {
                    console.error("Failed to delete campaign:", err);
                    setStatusUpdateError("Failed to delete campaign. Please try again.");
                  }
                }}
                disabled={deleteMutation.isPending}
                className="text-error hover:text-error"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
