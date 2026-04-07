"use client";

import { useParams, useRouter } from "next/navigation";
import { useCampaign, useCampaignAnalytics } from "@/lib/hooks/use-campaigns";
import { useCampaignExperiments, useExperimentBatches } from "@/lib/hooks/use-experiments";
import { Badge } from "@/components/ui";

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

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <Badge variant={statusVariant}>{campaign.status}</Badge>
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
    </div>
  );
}
