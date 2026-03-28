"use client";

import { useParams, useRouter } from "next/navigation";
import { useJourney, useDeleteJourney, useEnrollContacts } from "@/lib/hooks/use-journeys";
import { useState } from "react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  enrolled: "bg-blue-500/10 text-blue-400",
  initial_sent: "bg-cyan-500/10 text-cyan-400",
  first_followup_sent: "bg-indigo-500/10 text-indigo-400",
  second_followup_sent: "bg-violet-500/10 text-violet-400",
  hail_mary_sent: "bg-amber-500/10 text-amber-400",
  completed: "bg-green-500/10 text-green-400",
  removed: "bg-red-500/10 text-red-400",
};

export default function JourneyBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: journey, isLoading, error } = useJourney(id);
  const deleteMutation = useDeleteJourney();
  const enrollMutation = useEnrollContacts();
  const [enrollIds, setEnrollIds] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="text-sm font-medium text-on-surface mb-1">Journey not found</h3>
        <p className="text-xs text-on-surface-variant mb-4">
          {error?.message ?? "The journey you're looking for doesn't exist."}
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

  const progress = journey.progress;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/campaigns" className="hover:text-primary transition-colors">Campaigns</Link>
            <span>/</span>
            <span>Journey</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface">{journey.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            journey.status === "active" ? "bg-green-500/10 text-green-400" :
            journey.status === "paused" ? "bg-amber-500/10 text-amber-400" :
            "bg-surface-container text-on-surface-variant"
          }`}>
            {journey.status}
          </span>
          <button
            onClick={async () => {
              if (!confirm("Delete this journey? All enrollments will be removed.")) return;
              try {
                await deleteMutation.mutateAsync(id);
                router.push("/campaigns");
              } catch {
                // Error handled by deleteMutation.error state
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            aria-label="Delete journey"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {deleteMutation.isError && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-xs text-error">
          Delete failed: {deleteMutation.error.message}
        </div>
      )}

      {/* Progress Summary */}
      {progress && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Enrolled", value: progress.totalEnrolled, color: "text-on-surface" },
            { label: "Active", value: progress.active, color: "text-blue-400" },
            { label: "Completed", value: progress.completed, color: "text-green-400" },
            { label: "Removed", value: progress.removed, color: "text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">{stat.label}</div>
              <div className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Journey Steps Timeline */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 mb-6">
        <h2 className="text-sm font-medium text-on-surface mb-4">Journey Steps</h2>
        <div className="space-y-0">
          {journey.steps?.map((step, i) => (
            <div key={step.id} className="relative flex items-start gap-4">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                }`}>
                  {step.stepNumber}
                </div>
                {i < (journey.steps?.length ?? 0) - 1 && (
                  <div className="w-px flex-1 bg-outline-variant min-h-[40px]" />
                )}
              </div>

              {/* Step card */}
              <div className="flex-1 pb-6">
                <div className="rounded-lg border border-outline-variant bg-surface p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-on-surface">{step.name}</span>
                    <span className="text-[10px] text-on-surface-variant">
                      {step.delayDays === 0 ? "Immediately" : `+${step.delayDays} day${step.delayDays !== 1 ? "s" : ""}`}
                      {step.delayHour !== null && ` at ${step.delayHour}:00`}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    Template: {step.templateId ? (
                      <Link href={`/templates/${step.templateId}/edit`} className="text-primary hover:underline">
                        Edit template
                      </Link>
                    ) : (
                      <span className="text-amber-400">Not assigned</span>
                    )}
                  </div>
                  {/* Progress bar for this step */}
                  {progress && progress.byStep[step.name.toLowerCase().replace(/ /g, "_") + "_sent"] && (
                    <div className="mt-2 text-[10px] text-on-surface-variant">
                      {progress.byStep[step.name.toLowerCase().replace(/ /g, "_") + "_sent"]} contacts at this step
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enrollment Section */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 mb-6">
        <h2 className="text-sm font-medium text-on-surface mb-3">Enroll Contacts</h2>
        <p className="text-xs text-on-surface-variant mb-3">
          Paste comma-separated contact IDs to enroll them in this journey.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={enrollIds}
            onChange={(e) => setEnrollIds(e.target.value)}
            placeholder="contact-id-1, contact-id-2, ..."
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={async () => {
              const ids = enrollIds.split(",").map((s) => s.trim()).filter(Boolean);
              if (ids.length === 0) return;
              try {
                await enrollMutation.mutateAsync({ journeyId: id, contactIds: ids });
                setEnrollIds("");
              } catch {
                // Error handled by enrollMutation.error state (displayed in UI)
              }
            }}
            disabled={enrollMutation.isPending || !enrollIds.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
          </button>
        </div>
        {enrollMutation.isSuccess && (
          <div className="mt-2 text-xs text-green-400">
            Contacts enrolled successfully!
          </div>
        )}
        {enrollMutation.isError && (
          <div className="mt-2 text-xs text-error">
            {enrollMutation.error.message}
          </div>
        )}
      </div>

      {/* Status Distribution */}
      {progress && progress.totalEnrolled > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="text-sm font-medium text-on-surface mb-4">Status Distribution</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(progress.byStep).map(([status, count]) => (
              <div
                key={status}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-surface-container text-on-surface-variant"}`}
              >
                {status.replace(/_/g, " ")}: {count}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
