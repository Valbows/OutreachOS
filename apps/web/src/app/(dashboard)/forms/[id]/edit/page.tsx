"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm as useFormData, useUpdateForm, useDeleteForm } from "@/lib/hooks/use-forms";
import { useState, useEffect } from "react";
import Link from "next/link";

interface FormField {
  id?: number; // Unique identifier for React keys
  name: string;
  type: string;
  required: boolean;
  label: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

const FIELD_TYPES = ["text", "email", "phone", "dropdown", "checkbox", "textarea", "hidden"] as const;

export default function FormEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: form, isLoading, error } = useFormData(id);
  const updateMutation = useUpdateForm();
  const deleteMutation = useDeleteForm();

  const [name, setName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [activeTab, setActiveTab] = useState<"fields" | "design" | "settings">("fields");

  useEffect(() => {
    if (form) {
      setName(form.name);
      setFields((form.fields as FormField[]) ?? []);
      setSuccessMessage(form.successMessage ?? "");
      setRedirectUrl(form.redirectUrl ?? "");
      setHtmlContent(form.htmlContent ?? "");
      setCssContent(form.cssContent ?? "");
    }
  }, [form]);

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        id,
        name,
        fields,
        successMessage,
        redirectUrl: redirectUrl || undefined,
        htmlContent,
        cssContent,
      });
    } catch {
      // Error is handled by updateMutation.error state (displayed in UI)
      // No need to rethrow — TanStack Query tracks error state
    }
  }

  // Unique ID counter for fields (persists across renders)
  const [fieldIdCounter, setFieldIdCounter] = useState(1);

  function addField() {
    const newId = fieldIdCounter;
    setFieldIdCounter(prev => prev + 1);
    setFields([...fields, { id: newId, name: "", type: "text", required: false, label: "" }]);
  }

  function updateField(index: number, updates: Partial<FormField>) {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    if (updates.label && !updated[index].name) {
      updated[index].name = updates.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
    }
    setFields(updated);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFields(updated);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <h3 className="text-sm font-medium text-on-surface mb-1">Form not found</h3>
        <Link href="/forms" className="text-xs text-primary hover:underline">Back to Forms</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/forms" className="hover:text-primary transition-colors">Forms</Link>
            <span>/</span>
            <span>Edit</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-2xl font-semibold tracking-tight text-on-surface bg-transparent border-none outline-none focus:ring-0 p-0"
            aria-label="Form name"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/forms/${id}/embed`}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container transition-colors"
          >
            Embed Code
          </Link>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={async () => {
              if (!confirm("Delete this form?")) return;
              try {
                await deleteMutation.mutateAsync(id);
                router.push("/forms");
              } catch {
                // Error handled by deleteMutation.error state
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            aria-label="Delete form"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {updateMutation.isSuccess && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2 text-xs text-green-400">Form saved!</div>
      )}
      {updateMutation.isError && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-xs text-error">{updateMutation.error.message}</div>
      )}
      {deleteMutation.isError && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-xs text-error">Delete failed: {deleteMutation.error.message}</div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-outline-variant">
        {(["fields", "design", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Fields tab */}
      {activeTab === "fields" && (
        <div className="space-y-3">
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                    placeholder="Field label"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value })}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Name</label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                    placeholder="field_name"
                  />
                </div>
                <div className="col-span-2 flex items-end gap-1">
                  <label className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                      className="rounded border-outline-variant"
                    />
                    Req
                  </label>
                  <button onClick={() => moveField(i, -1)} disabled={i === 0} className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30" aria-label="Move up">↑</button>
                  <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30" aria-label="Move down">↓</button>
                  <button onClick={() => removeField(i)} className="p-1 text-error hover:text-error/80" aria-label="Remove field">×</button>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addField}
            className="w-full rounded-xl border border-dashed border-outline-variant py-3 text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            + Add Field
          </button>
        </div>
      )}

      {/* Design tab */}
      {activeTab === "design" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">HTML</label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              rows={16}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">CSS</label>
            <textarea
              value={cssContent}
              onChange={(e) => setCssContent(e.target.value)}
              rows={16}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Settings tab */}
      {activeTab === "settings" && (
        <div className="space-y-4 max-w-lg">
          <div>
            <label htmlFor="success-msg" className="block text-sm font-medium text-on-surface mb-1">Success Message</label>
            <input
              id="success-msg"
              type="text"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="Thank you for your submission!"
            />
          </div>
          <div>
            <label htmlFor="redirect-url" className="block text-sm font-medium text-on-surface mb-1">Redirect URL (optional)</label>
            <input
              id="redirect-url"
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="https://example.com/thank-you"
            />
          </div>
          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <div className="text-sm font-medium text-on-surface mb-1">Form Type</div>
            <div className="text-xs text-on-surface-variant capitalize">{form.type.replace(/_/g, " ")}</div>
          </div>
          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <div className="text-sm font-medium text-on-surface mb-1">Submissions</div>
            <div className="text-xs text-on-surface-variant">{form.submissionCount ?? 0} total</div>
          </div>
        </div>
      )}
    </div>
  );
}
