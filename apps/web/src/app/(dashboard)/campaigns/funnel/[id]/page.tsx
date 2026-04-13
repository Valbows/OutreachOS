"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useFunnel, useFunnelProgress } from "@/lib/hooks/use-campaigns";

const CONDITION_LABELS: Record<string, string> = {
  did_not_open: "Did not open campaign",
  opened_more_than: "Opened campaign more than threshold",
  replied: "Replied to campaign",
  filled_form: "Filled out form",
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-surface-container text-on-surface-variant",
  active: "bg-green-500/10 text-green-400",
  paused: "bg-amber-500/10 text-amber-400",
  completed: "bg-blue-500/10 text-blue-400",
  stopped: "bg-red-500/10 text-red-400",
};

export default function FunnelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: funnel, isLoading, error } = useFunnel(id);
  const { data: progress } = useFunnelProgress(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !funnel) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="mb-1 text-sm font-medium text-on-surface">Funnel not found</h3>
        <p className="mb-4 text-xs text-on-surface-variant">
          {error?.message ?? "The funnel you're looking for doesn't exist."}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-on-surface-variant">
            <Link href="/campaigns" className="hover:text-primary transition-colors">
              Campaigns
            </Link>
            <span>/</span>
            <span>Funnel</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{funnel.name}</h1>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_CLASSES[funnel.status] ?? STATUS_CLASSES.draft
          }`}
        >
          {funnel.status}
        </span>
      </div>

      {progress && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { label: "Total Enrolled", value: progress.totalEnrolled, color: "text-on-surface" },
            { label: "Active", value: progress.active, color: "text-blue-400" },
            { label: "Completed", value: progress.completed, color: "text-green-400" },
            { label: "Removed", value: progress.removed, color: "text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-on-surface-variant">{stat.label}</div>
              <div className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="mb-4 text-sm font-medium text-on-surface">Entry Conditions</h2>
          <div className="space-y-3">
            {funnel.conditions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-outline-variant/50 bg-surface px-4 py-6 text-sm text-on-surface-variant">
                No entry conditions configured.
              </div>
            ) : (
              funnel.conditions.map((condition) => (
                <div key={condition.id} className="rounded-lg border border-outline-variant bg-surface p-4">
                  <div className="text-sm font-medium text-on-surface">
                    {CONDITION_LABELS[condition.conditionType] ?? condition.conditionType}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                    {condition.referenceCampaignId && <div>Campaign: {condition.referenceCampaignId}</div>}
                    {condition.referenceFormId && <div>Form: {condition.referenceFormId}</div>}
                    {condition.threshold != null && <div>Threshold: {condition.threshold}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="mb-4 text-sm font-medium text-on-surface">Funnel Steps</h2>
          <div className="space-y-3">
            {funnel.steps.map((step) => (
              <div key={step.id} className="rounded-lg border border-outline-variant bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-on-surface">
                      {step.stepNumber}. {step.name}
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {(step.delayDays ?? 0) === 0 ? "Immediately" : `+${step.delayDays ?? 0} day${step.delayDays === 1 ? "" : "s"}`}
                      {step.delayHour != null ? ` at ${step.delayHour}:00` : ""}
                    </div>
                  </div>
                  {step.templateId ? (
                    <Link
                      href={`/templates/${step.templateId}/edit`}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit template
                    </Link>
                  ) : (
                    <span className="text-xs text-amber-400">No template</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {progress && progress.totalEnrolled > 0 && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="mb-4 text-sm font-medium text-on-surface">Status Distribution</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(progress.byStatus).map(([status, count]) => (
              <div
                key={status}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${STATUS_CLASSES[status] ?? STATUS_CLASSES.draft}`}
              >
                {status.replace(/_/g, " ")}: {count}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
