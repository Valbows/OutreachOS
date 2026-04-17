"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCampaign, useCampaignAnalytics, useUpdateCampaign } from "@/lib/hooks/use-campaigns";
import { useCampaignExperiments, useExperimentBatches } from "@/lib/hooks/use-experiments";
import { Badge, Button } from "@/components/ui";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="text-xs font-medium text-on-surface-variant">{label}</div>
      <div className="text-2xl font-semibold text-on-surface mt-1">{value}</div>
      {subtext && <div className="text-[10px] text-on-surface-variant mt-0.5">{subtext}</div>}
    </div>
  );
}

function HeatmapRow({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const intensity = maxValue > 0 ? value / maxValue : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-on-surface-variant w-8 text-right shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded bg-surface-container overflow-hidden">
        <div
          className="h-full rounded bg-primary transition-all"
          style={{ width: `${intensity * 100}%`, opacity: Math.max(0.2, intensity) }}
        />
      </div>
      <span className="text-[10px] text-on-surface-variant w-8 shrink-0">{value}</span>
    </div>
  );
}

interface ExperimentData {
  id: string;
  name: string;
  type: string;
  status: string;
  championVariant: string | null;
  consecutiveWins: number | null;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  currentScheduledAt: string | null | undefined;
  campaignName: string;
}

function ScheduleModal({ isOpen, onClose, campaignId, currentScheduledAt, campaignName }: ScheduleModalProps) {
  const [mode, setMode] = useState<"now" | "later">(() => (currentScheduledAt ? "later" : "now"));
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (!currentScheduledAt) return "";
    const d = new Date(currentScheduledAt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateCampaign = useUpdateCampaign();

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleEscape = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reset local state when the modal opens (or when currentScheduledAt changes while open)
  // so reopening reflects the latest props rather than stale state from a prior session.
  useEffect(() => {
    if (!isOpen) return;
    setMode(currentScheduledAt ? "later" : "now");
    if (currentScheduledAt) {
      const d = new Date(currentScheduledAt);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setScheduledAt(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    } else {
      setScheduledAt("");
    }
    setError("");
    setIsSubmitting(false);
  }, [isOpen, currentScheduledAt]);

  // Document-level Escape key listener since the backdrop div can't receive keyboard events
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleEscape();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleEscape]);

  const handleSubmit = async () => {
    setError("");

    if (mode === "later") {
      if (!scheduledAt) {
        setError("Please select a date and time");
        return;
      }
      const selected = new Date(scheduledAt);
      if (isNaN(selected.getTime()) || selected.getTime() <= Date.now()) {
        setError("Please select a future date and time");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateCampaign.mutateAsync({
        id: campaignId,
        scheduledAt: mode === "now" ? null : scheduledAt,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface p-6 shadow-xl">
        <h2 id="schedule-modal-title" className="text-lg font-semibold text-on-surface mb-1">
          {currentScheduledAt ? "Reschedule Campaign" : "Schedule Campaign"}
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">{campaignName}</p>

        <div className="space-y-4">
          {/* Send Now Option */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              mode === "now"
                ? "border-primary bg-primary/5"
                : "border-outline-variant hover:border-outline"
            }`}
            onClick={() => setMode("now")}
            role="radio"
            aria-checked={mode === "now"}
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setMode("now")}
          >
            <div
              className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                mode === "now" ? "border-primary" : "border-outline"
              }`}
            >
              {mode === "now" && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </div>
            <div>
              <div className="text-sm font-medium text-on-surface">Send immediately</div>
              <div className="text-xs text-on-surface-variant">Campaign will be sent right away</div>
            </div>
          </div>

          {/* Schedule Later Option */}
          <div
            className={`rounded-xl border p-4 cursor-pointer transition-colors ${
              mode === "later"
                ? "border-primary bg-primary/5"
                : "border-outline-variant hover:border-outline"
            }`}
            onClick={() => setMode("later")}
            role="radio"
            aria-checked={mode === "later"}
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setMode("later")}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  mode === "later" ? "border-primary" : "border-outline"
                }`}
              >
                {mode === "later" && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </div>
              <div>
                <div className="text-sm font-medium text-on-surface">Schedule for later</div>
                <div className="text-xs text-on-surface-variant mb-3">Choose a future date and time</div>
              </div>
            </div>

            {mode === "later" && (
              <div className="mt-3 pl-8">
                <label htmlFor="schedule-datetime" className="sr-only">
                  Scheduled date and time
                </label>
                <input
                  id="schedule-datetime"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-invalid={!!error && !scheduledAt}
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" aria-live="assertive" className="text-xs text-error">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: ExperimentData }) {
  const { data: batches } = useExperimentBatches(experiment.id);

  const statusVariant =
    experiment.status === "champion_found" ? "success"
    : experiment.status === "production" ? "success"
    : experiment.status === "active" ? "warning"
    : "secondary";

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-on-surface">{experiment.name}</h3>
            <Badge variant={statusVariant}>{experiment.status.replaceAll("_", " ")}</Badge>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">
            Type: {experiment.type.replaceAll("_", " ")}
            {experiment.championVariant && (
              <span className="ml-2 text-primary font-medium">
                Champion: {experiment.championVariant}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-on-surface-variant">
          {batches?.length ?? 0} batches
        </div>
      </div>

      {/* Variant Breakdown — side-by-side A/B stats per batch */}
      {batches && batches.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
            Batch Results
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="text-left py-1.5 pr-3 font-medium">#</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Variant A</th>
                  <th className="text-right py-1.5 pr-3 font-medium">A Open %</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Variant B</th>
                  <th className="text-right py-1.5 pr-3 font-medium">B Open %</th>
                  <th className="text-center py-1.5 font-medium">Winner</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-outline-variant/50">
                    <td className="py-1.5 pr-3 text-on-surface-variant">{batch.batchNumber}</td>
                    <td className="py-1.5 pr-3 text-on-surface truncate max-w-[120px]" title={batch.variantA}>
                      {batch.variantA}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {batch.variantAOpenRate !== null
                        ? `${(batch.variantAOpenRate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-on-surface truncate max-w-[120px]" title={batch.variantB}>
                      {batch.variantB}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {batch.variantBOpenRate !== null
                        ? `${(batch.variantBOpenRate * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-1.5 text-center">
                      {batch.winner === "variant_a" && (
                        <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">A</span>
                      )}
                      {batch.winner === "variant_b" && (
                        <span className="inline-block rounded bg-tertiary/10 px-1.5 py-0.5 text-[10px] font-medium text-tertiary">B</span>
                      )}
                      {batch.winner === "tie" && (
                        <span className="inline-block rounded bg-surface-container px-1.5 py-0.5 text-[10px] text-on-surface-variant">Tie</span>
                      )}
                      {!batch.winner && batch.evaluatedAt && (
                        <span className="text-[10px] text-on-surface-variant">Inconclusive</span>
                      )}
                      {!batch.winner && !batch.evaluatedAt && (
                        <span className="text-[10px] text-on-surface-variant">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Decision rationale for most recent evaluated batch */}
          {(() => {
            const lastEvaluated = [...(batches ?? [])].reverse().find((b) => b.evaluatedAt);
            if (!lastEvaluated?.decisionRationale) return null;
            return (
              <div className="rounded-lg bg-surface-container p-3">
                <div className="text-[10px] font-medium text-on-surface-variant mb-1">Latest Decision</div>
                <div className="text-xs text-on-surface">{lastEvaluated.decisionRationale}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function CampaignAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: analytics, isLoading: loadingAnalytics } = useCampaignAnalytics(campaignId);
  const { data: experiments } = useCampaignExperiments(campaignId);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const isLoading = loadingCampaign || loadingAnalytics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-on-surface-variant">Campaign not found</p>
        <button onClick={() => router.push("/campaigns")} className="mt-2 text-sm text-primary hover:underline">
          Back to Campaigns
        </button>
      </div>
    );
  }

  const metrics = analytics?.metrics;
  const hourly = analytics?.hourly ?? [];
  const daily = analytics?.daily ?? [];

  const maxHourlyOpens = Math.max(...hourly.map((h) => h.opens), 1);
  const maxDailyOpens = Math.max(...daily.map((d) => d.opens), 1);

  const statusVariant =
    campaign.status === "active" ? "success"
    : campaign.status === "completed" ? "success"
    : campaign.status === "paused" ? "warning"
    : campaign.status === "stopped" ? "error"
    : "secondary";

  return (
    <div>
      <button
        onClick={() => router.push("/campaigns")}
        className="mb-4 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        &larr; Back to Campaigns
      </button>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <Badge variant={statusVariant}>{campaign.status}</Badge>
        {campaign.scheduledAt && (
          <span className="text-xs text-on-surface-variant">
            Scheduled: {new Date(campaign.scheduledAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsScheduleModalOpen(true)}
          >
            {campaign.scheduledAt ? "Reschedule" : "Schedule"}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Sent"
          value={metrics?.totalSent ?? 0}
          subtext={`${metrics?.totalDelivered ?? 0} delivered`}
        />
        <StatCard
          label="Open Rate"
          value={`${((metrics?.openRate ?? 0) * 100).toFixed(1)}%`}
          subtext={`${metrics?.uniqueOpens ?? 0} unique opens`}
        />
        <StatCard
          label="Click Rate"
          value={`${((metrics?.clickRate ?? 0) * 100).toFixed(1)}%`}
          subtext={`${metrics?.totalClicked ?? 0} clicks`}
        />
        <StatCard
          label="Bounce Rate"
          value={`${((metrics?.bounceRate ?? 0) * 100).toFixed(1)}%`}
          subtext={`${metrics?.totalBounced ?? 0} bounces`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Failed" value={metrics?.totalFailed ?? 0} />
        <StatCard
          label="Complaint Rate"
          value={`${((metrics?.complaintRate ?? 0) * 100).toFixed(2)}%`}
          subtext={`${metrics?.totalComplained ?? 0} complaints`}
        />
        <StatCard
          label="Unsubscribed"
          value={metrics?.totalUnsubscribed ?? 0}
          subtext={`${((metrics?.unsubscribeRate ?? 0) * 100).toFixed(2)}%`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Hourly Heatmap */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-sm font-medium text-on-surface mb-3">Opens by Hour of Day</h3>
          <div className="space-y-1">
            {hourly.map((h) => (
              <HeatmapRow
                key={h.hour}
                label={`${h.hour.toString().padStart(2, "0")}:00`}
                value={h.opens}
                maxValue={maxHourlyOpens}
              />
            ))}
          </div>
        </div>

        {/* Daily Chart */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-sm font-medium text-on-surface mb-3">Opens by Day of Week</h3>
          <div className="space-y-1">
            {daily.map((d) => (
              <HeatmapRow
                key={d.dayOfWeek}
                label={DAY_LABELS[d.dayOfWeek]}
                value={d.opens}
                maxValue={maxDailyOpens}
              />
            ))}
          </div>
        </div>
      </div>

      {/* A/B Experiment Log & Variant Breakdown */}
      {experiments && experiments.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-on-surface">A/B Experiments</h2>
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        campaignId={campaignId}
        currentScheduledAt={campaign.scheduledAt}
        campaignName={campaign.name}
      />
    </div>
  );
}
