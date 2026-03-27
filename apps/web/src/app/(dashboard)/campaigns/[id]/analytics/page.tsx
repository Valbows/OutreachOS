"use client";

import { useParams, useRouter } from "next/navigation";
import { useCampaign, useCampaignAnalytics } from "@/lib/hooks/use-campaigns";
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

export default function CampaignAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { data: campaign, isLoading: loadingCampaign } = useCampaign(campaignId);
  const { data: analytics, isLoading: loadingAnalytics } = useCampaignAnalytics(campaignId);

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

      <div className="grid md:grid-cols-2 gap-6">
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
    </div>
  );
}
