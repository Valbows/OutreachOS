"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateFunnel } from "@/lib/hooks/use-campaigns";
import { useContactGroups, type ContactGroup } from "@/lib/hooks/use-contacts";
import { useTemplates } from "@/lib/hooks/use-templates";
import { useForms } from "@/lib/hooks/use-forms";
import { Badge } from "@/components/ui";

const CONDITION_TYPES: Array<{
  value: string;
  label: string;
  needsRef?: boolean;
  needsFormRef?: boolean;
  needsThreshold?: boolean;
}> = [
  { value: "did_not_open", label: "Did not open campaign", needsRef: true },
  { value: "opened_more_than", label: "Opened campaign more than X times", needsRef: true, needsThreshold: true },
  { value: "replied", label: "Replied to campaign", needsRef: true },
  { value: "filled_form", label: "Filled out form", needsFormRef: true },
];

const DEFAULT_STEPS = [
  { name: "Initial", delayDays: 0, delayHour: 9 },
  { name: "1st Follow Up", delayDays: 3, delayHour: 9 },
  { name: "2nd Follow Up", delayDays: 5, delayHour: 9 },
  { name: "Hail Mary", delayDays: 7, delayHour: 9 },
];

/** Form selector sub-component */
function FormSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: forms, isLoading } = useForms();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
    >
      <option value="">Select form...</option>
      {isLoading ? (
        <option disabled>Loading forms...</option>
      ) : (
        forms?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))
      )}
    </select>
  );
}

export default function FunnelBuilderPage() {
  const router = useRouter();
  const createMutation = useCreateFunnel();
  const { data: groups, isLoading: groupsLoading } = useContactGroups();
  const { data: templates, isLoading: templatesLoading } = useTemplates();

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [conditions, setConditions] = useState<Array<{
    conditionType: string;
    referenceCampaignId?: string;
    referenceFormId?: string;
    threshold?: number;
  }>>([{ conditionType: "did_not_open" }]);
  const [steps, setSteps] = useState(DEFAULT_STEPS.map((s) => ({ ...s, templateId: "" })));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCondition = () => {
    setConditions([...conditions, { conditionType: "did_not_open" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<typeof conditions[0]>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const updateStep = (index: number, updates: Partial<typeof steps[0]>) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Funnel name is required");
      return;
    }
    if (!groupId) {
      setError("Select a contact group");
      return;
    }
    if (conditions.some((c) => !c.conditionType)) {
      setError("All conditions must have a type selected");
      return;
    }
    for (const c of conditions) {
      const typeInfo = CONDITION_TYPES.find((t) => t.value === c.conditionType);
      if (typeInfo?.needsRef && !c.referenceCampaignId) {
        setError("Conditions requiring a campaign reference must have Campaign ID provided");
        return;
      }
      if (typeInfo?.needsFormRef && !c.referenceFormId) {
        setError("Conditions requiring a form reference must have Form selected");
        return;
      }
    }
    if (steps.some((s) => !s.templateId)) {
      setError("All steps must have a template assigned");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        groupId,
        conditions,
        steps: steps.map((s) => ({
          name: s.name,
          templateId: s.templateId,
          delayDays: s.delayDays,
          delayHour: s.delayHour ?? 9,
        })),
      });
      router.push(`/campaigns/funnel/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create funnel");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/campaigns"
          className="text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          ← Back to Campaigns
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight mb-2">Funnel Builder</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        Create behavioral email funnels based on contact actions.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-on-surface">Funnel Details</h2>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Non-Openers Follow-up"
              className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              Target Group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-outline rounded-lg text-sm"
              required
            >
              <option value="">Select a group...</option>
              {groupsLoading ? (
                <option disabled>Loading groups...</option>
              ) : (
                groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.contactCount ?? 0} contacts)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Entry Conditions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-on-surface">Entry Conditions</h2>
            <button
              type="button"
              onClick={addCondition}
              className="text-xs text-primary hover:underline"
            >
              + Add condition
            </button>
          </div>

          <div className="space-y-3">
            {conditions.map((condition, i) => {
              const typeInfo = CONDITION_TYPES.find((t) => t.value === condition.conditionType);
              return (
                <div key={i} className="p-4 bg-surface-container-low rounded-lg border border-outline-variant">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <label className="block text-xs text-on-surface-variant mb-1">Condition</label>
                      <select
                        value={condition.conditionType}
                        onChange={(e) =>
                          updateCondition(i, { conditionType: e.target.value, threshold: undefined })
                        }
                        className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                      >
                        {CONDITION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {typeInfo?.needsRef && (
                      <div className="col-span-4">
                        <label className="block text-xs text-on-surface-variant mb-1">Campaign</label>
                        <input
                          type="text"
                          value={condition.referenceCampaignId ?? ""}
                          onChange={(e) =>
                            updateCondition(i, { referenceCampaignId: e.target.value || undefined })
                          }
                          placeholder="Campaign ID"
                          className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                        />
                      </div>
                    )}

                    {typeInfo?.needsThreshold && (
                      <div className="col-span-2">
                        <label className="block text-xs text-on-surface-variant mb-1">Threshold</label>
                        <input
                          type="number"
                          value={condition.threshold ?? ""}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value);
                            const value = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
                            updateCondition(i, { threshold: value });
                          }}
                          min={1}
                          className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                        />
                      </div>
                    )}

                    {typeInfo?.needsFormRef && (
                      <div className="col-span-4">
                        <label className="block text-xs text-on-surface-variant mb-1">Form</label>
                        <FormSelect
                          value={condition.referenceFormId ?? ""}
                          onChange={(value) =>
                            updateCondition(i, { referenceFormId: value || undefined })
                          }
                        />
                      </div>
                    )}

                    <div className="col-span-2 flex items-end justify-end">
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(i)}
                          className="text-xs text-error hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-on-surface-variant">
            Contacts must meet ALL conditions to enter the funnel.
          </p>
        </div>

        {/* Funnel Steps */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-on-surface">Funnel Steps</h2>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="p-4 bg-surface-container-low rounded-lg border border-outline-variant"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="secondary">Step {i + 1}</Badge>
                  <span className="font-medium text-sm">{step.name}</span>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-5">
                    <label className="block text-xs text-on-surface-variant mb-1">Template</label>
                    <select
                      value={step.templateId}
                      onChange={(e) => updateStep(i, { templateId: e.target.value })}
                      className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                      required
                    >
                      <option value="">Select template...</option>
                      {templates?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs text-on-surface-variant mb-1">
                      Delay (days)
                    </label>
                    <input
                      type="number"
                      value={step.delayDays}
                      onChange={(e) =>
                        updateStep(i, { delayDays: parseInt(e.target.value) || 0 })
                      }
                      min={0}
                      className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-xs text-on-surface-variant mb-1">
                      Send at hour (UTC)
                    </label>
                    <input
                      type="number"
                      value={step.delayHour ?? 9}
                      onChange={(e) =>
                        updateStep(i, { delayHour: parseInt(e.target.value) || 9 })
                      }
                      min={0}
                      max={23}
                      className="w-full px-2 py-1.5 bg-surface-container border border-outline rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4 border-t border-outline-variant">
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Funnel"}
          </button>
          <Link
            href="/campaigns"
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
