"use client";

import { useParams, useRouter } from "next/navigation";
import { useJourney, useDeleteJourney, useEnrollContacts, useAddJourneyStep, useUpdateJourneyStep, useDeleteJourneyStep } from "@/lib/hooks/use-journeys";
import { useTemplates } from "@/lib/hooks/use-templates";
import { useUpdateCampaign } from "@/lib/hooks/use-campaigns";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

const STATUS_COLORS: Record<string, string> = {
  enrolled: "bg-blue-500/10 text-blue-400",
  initial_sent: "bg-cyan-500/10 text-cyan-400",
  first_followup_sent: "bg-indigo-500/10 text-indigo-400",
  second_followup_sent: "bg-violet-500/10 text-violet-400",
  hail_mary_sent: "bg-amber-500/10 text-amber-400",
  completed: "bg-green-500/10 text-green-400",
  removed: "bg-red-500/10 text-red-400",
};

interface StepModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeyId: string;
  step?: { id: string; name: string; templateId: string | null; delayDays: number | null; delayHour: number | null };
  mode: "add" | "edit";
}

function StepModal({ isOpen, onClose, journeyId, step, mode }: StepModalProps) {
  const { data: templates } = useTemplates();
  const addStep = useAddJourneyStep();
  const updateStep = useUpdateJourneyStep();
  
  const [name, setName] = useState(mode === "edit" ? step?.name ?? "" : "");
  const [templateId, setTemplateId] = useState(step?.templateId ?? "");
  const [delayDays, setDelayDays] = useState(step?.delayDays ?? 1);
  const [delayHour, setDelayHour] = useState<number | null>(step?.delayHour ?? 9);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(mode === "edit" ? step?.name ?? "" : "");
      setTemplateId(step?.templateId ?? "");
      setDelayDays(step?.delayDays ?? 1);
      setDelayHour(step?.delayHour ?? 9);
      setError("");
    }
  }, [isOpen, step, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("Step name is required");
      return;
    }
    
    try {
      if (mode === "edit" && step) {
        await updateStep.mutateAsync({
          journeyId,
          stepId: step.id,
          data: { templateId: templateId || undefined, delayDays, delayHour },
        });
      } else {
        await addStep.mutateAsync({
          journeyId,
          data: { name: name.trim(), templateId: templateId || undefined, delayDays, delayHour },
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save step");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-on-surface mb-4">
          {mode === "edit" ? "Edit Step" : "Add New Step"}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Step Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Follow-up 1"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              disabled={mode === "edit"}
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">Select a template...</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Delay (days)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={delayDays}
                onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Send Hour (0-23)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={delayHour ?? ""}
                onChange={(e) => setDelayHour(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Optional"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
        
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={addStep.isPending || updateStep.isPending}
          >
            {addStep.isPending || updateStep.isPending ? "Saving..." : mode === "edit" ? "Update Step" : "Add Step"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeyId: string;
  currentScheduledAt: string | null | undefined;
  journeyName: string;
}

function ScheduleModal({ isOpen, onClose, journeyId, currentScheduledAt, journeyName }: ScheduleModalProps) {
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
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleEscape = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

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
        id: journeyId,
        scheduledAt: mode === "now" ? null : new Date(scheduledAt).toISOString(),
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
      onKeyDown={handleEscape}
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-schedule-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface p-6 shadow-xl">
        <h2 id="journey-schedule-modal-title" className="text-lg font-semibold text-on-surface mb-1">
          {currentScheduledAt ? "Reschedule Journey" : "Schedule Journey"}
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">{journeyName}</p>

        <div className="space-y-4">
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
              <div className="text-sm font-medium text-on-surface">Start immediately</div>
              <div className="text-xs text-on-surface-variant">Journey will begin when contacts are enrolled</div>
            </div>
          </div>

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
                <div className="text-xs text-on-surface-variant mb-3">Choose when enrolled contacts should start receiving emails</div>
              </div>
            </div>

            {mode === "later" && (
              <div className="mt-3 pl-8">
                <label htmlFor="journey-schedule-datetime" className="sr-only">
                  Journey start date and time
                </label>
                <input
                  id="journey-schedule-datetime"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-invalid={!!error && !scheduledAt}
                />
              </div>
            )}
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="text-xs text-error">
              {error}
            </div>
          )}
        </div>

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

export default function JourneyBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: journey, isLoading, error } = useJourney(id);
  const deleteMutation = useDeleteJourney();
  const enrollMutation = useEnrollContacts();
  const deleteStepMutation = useDeleteJourneyStep();
  const [enrollIds, setEnrollIds] = useState("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [stepModalState, setStepModalState] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    step?: { id: string; name: string; templateId: string | null; delayDays: number | null; delayHour: number | null };
  }>({ isOpen: false, mode: "add" });

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
          {journey.scheduledAt && (
            <span className="text-xs text-on-surface-variant hidden sm:inline">
              Starts: {new Date(journey.scheduledAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            journey.status === "active" ? "bg-green-500/10 text-green-400" :
            journey.status === "paused" ? "bg-amber-500/10 text-amber-400" :
            "bg-surface-container text-on-surface-variant"
          }`}>
            {journey.status}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsScheduleModalOpen(true)}
          >
            {journey.scheduledAt ? "Reschedule" : "Schedule"}
          </Button>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-on-surface">Journey Steps</h2>
          <Button
            size="sm"
            onClick={() => setStepModalState({ isOpen: true, mode: "add" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-1">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Step
          </Button>
        </div>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-surface-variant">
                        {step.delayDays === 0 ? "Immediately" : `+${step.delayDays} day${step.delayDays !== 1 ? "s" : ""}`}
                        {step.delayHour !== null && ` at ${step.delayHour}:00`}
                      </span>
                      {/* Edit/Delete buttons */}
                      <button
                        onClick={() => setStepModalState({ isOpen: true, mode: "edit", step })}
                        className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                        title="Edit step"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {journey.steps && journey.steps.length > 1 && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete step "${step.name}"?`)) return;
                            try {
                              await deleteStepMutation.mutateAsync({ journeyId: id, stepId: step.id });
                            } catch {
                              // Error handled by mutation
                            }
                          }}
                          disabled={deleteStepMutation.isPending}
                          className="p-1 rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors disabled:opacity-50"
                          title="Delete step"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
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
        {deleteStepMutation.isError && (
          <div className="mt-4 text-xs text-error">
            Failed to delete step: {deleteStepMutation.error?.message}
          </div>
        )}
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

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        journeyId={id}
        currentScheduledAt={(journey as { scheduledAt?: string | null }).scheduledAt}
        journeyName={journey.name}
      />

      {/* Step Modal (Add/Edit) */}
      <StepModal
        isOpen={stepModalState.isOpen}
        onClose={() => setStepModalState({ isOpen: false, mode: "add" })}
        journeyId={id}
        step={stepModalState.step}
        mode={stepModalState.mode}
      />
    </div>
  );
}
