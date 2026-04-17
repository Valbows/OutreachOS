"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm as useFormData, useUpdateForm, useDeleteForm } from "@/lib/hooks/use-forms";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface FormField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  label: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

interface FormStep {
  id: string;
  stepNumber: number;
  title: string;
  fields: string[];
}

const FIELD_TYPES = ["text", "email", "phone", "dropdown", "checkbox", "textarea", "hidden"] as const;

function normalizeFields(nextFields: FormField[] | null | undefined): FormField[] {
  const fields = nextFields ?? [];
  // Collect existing numeric IDs to avoid collisions
  const usedIds = new Set<number>();
  for (const field of fields) {
    if (typeof field.id === "number") {
      usedIds.add(field.id);
    }
  }
  let nextId = Math.max(0, ...usedIds) + 1;
  return fields.map((field) => {
    if (typeof field.id === "number") {
      return field;
    }
    // Assign next unused ID
    while (usedIds.has(nextId)) {
      nextId++;
    }
    usedIds.add(nextId);
    return { ...field, id: nextId++ };
  });
}

function getNextFieldId(nextFields: FormField[]): number {
  return nextFields.reduce((max, field) => {
    if (typeof field.id === "number" && field.id > max) {
      return field.id;
    }
    return max;
  }, 0) + 1;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeCssContent(css: string): string {
  // Prevent breaking out of <style> tag via </style> (case-insensitive)
  // Replace </style with <\/style to keep CSS valid but prevent tag closure
  return css.replace(/<\/style/gi, "<\\/style");
}

function renderFieldPreview(field: FormField): string {
  const label = escapeHtml(field.label || "Untitled field");
  const name = escapeHtml(field.name || "field");
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const required = field.required ? " required" : "";
  const requiredIndicator = field.required ? " *" : "";
  const defaultValue = field.defaultValue ? escapeHtml(field.defaultValue) : "";

  if (field.type === "hidden") {
    return `<input type="hidden" name="${name}" value="${defaultValue}" />`;
  }

  if (field.type === "textarea") {
    return `<div class="form-field"><label>${label}${requiredIndicator}</label><textarea name="${name}"${placeholder}${required}>${defaultValue}</textarea></div>`;
  }

  if (field.type === "dropdown") {
    const options = (field.options ?? []).length > 0
      ? (field.options ?? [])
      : ["Option 1", "Option 2", "Option 3"];

    return `<div class="form-field"><label>${label}${requiredIndicator}</label><select name="${name}"${required}><option value="">Select an option</option>${options
      .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
      .join("")}</select></div>`;
  }

  if (field.type === "checkbox") {
    return `<div class="form-field checkbox-field"><label><input type="checkbox" name="${name}"${required}${defaultValue ? " checked" : ""} /> <span>${label}${requiredIndicator}</span></label></div>`;
  }

  const inputType = field.type === "phone" ? "tel" : field.type;
  return `<div class="form-field"><label>${label}${requiredIndicator}</label><input type="${inputType}" name="${name}" value="${defaultValue}"${placeholder}${required} /></div>`;
}

function injectFieldMarkup(template: string, fieldMarkup: string): string {
  const fallbackTemplate = template.trim() || `<form class="outreachos-form preview"><div class="form-fields"></div><button type="submit">Submit</button></form>`;

  if (/<div class="form-fields">\s*<\/div>/.test(fallbackTemplate)) {
    return fallbackTemplate.replace(/<div class="form-fields">\s*<\/div>/, `<div class="form-fields">${fieldMarkup}</div>`);
  }

  if (/<div class="step-content">\s*<\/div>/.test(fallbackTemplate)) {
    return fallbackTemplate.replace(/<div class="step-content">\s*<\/div>/, `<div class="step-content"><div class="form-fields">${fieldMarkup}</div></div>`);
  }

  if (fallbackTemplate.includes("</form>")) {
    return fallbackTemplate.replace("</form>", `${fieldMarkup}</form>`);
  }

  return `${fallbackTemplate}${fieldMarkup}`;
}

function buildPreviewDocument({
  name,
  fields,
  htmlContent,
  cssContent,
  successMessage,
  redirectUrl,
}: {
  name: string;
  fields: FormField[];
  htmlContent: string;
  cssContent: string;
  successMessage: string;
  redirectUrl: string;
}): string {
  const fieldMarkup = fields.length > 0
    ? fields.map((field) => renderFieldPreview(field)).join("")
    : `<div class="preview-empty">Add fields in the Fields tab to preview this form.</div>`;

  const resolvedHtml = injectFieldMarkup(htmlContent, fieldMarkup);
  const resolvedSuccessMessage = successMessage || "Thank you for your submission!";
  const resolvedRedirectUrl = redirectUrl.trim();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(name || "Form Preview")}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f8fafc;
        color: #111827;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .preview-shell {
        padding: 24px;
      }
      .preview-card {
        max-width: 720px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .preview-header {
        padding: 18px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }
      .preview-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .preview-body {
        padding: 20px;
      }
      .form-field {
        margin-bottom: 14px;
      }
      .form-field label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #374151;
      }
      .form-field.checkbox-field label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .form-field input:not([type="checkbox"]),
      .form-field textarea,
      .form-field select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        font: inherit;
        color: #111827;
        background: #ffffff;
      }
      .form-field textarea {
        min-height: 120px;
        resize: vertical;
      }
      button {
        cursor: pointer;
      }
      .preview-meta {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        display: grid;
        gap: 10px;
      }
      .preview-meta-item {
        font-size: 12px;
        color: #6b7280;
      }
      .preview-meta-item strong {
        display: block;
        margin-bottom: 4px;
        color: #374151;
      }
      .preview-empty {
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
        padding: 18px;
        font-size: 13px;
        color: #64748b;
        background: #f8fafc;
      }
      ${sanitizeCssContent(cssContent)}
    </style>
  </head>
  <body>
    <div class="preview-shell">
      <div class="preview-card">
        <div class="preview-header">
          <h2>${escapeHtml(name || "Untitled Form")}</h2>
        </div>
        <div class="preview-body">
          ${resolvedHtml}
          <div class="preview-meta">
            <div class="preview-meta-item">
              <strong>Success message</strong>
              <span>${escapeHtml(resolvedSuccessMessage)}</span>
            </div>
            ${resolvedRedirectUrl ? `<div class="preview-meta-item"><strong>Redirect URL</strong><span>${escapeHtml(resolvedRedirectUrl)}</span></div>` : ""}
          </div>
        </div>
      </div>
    </div>
    <script>
      document.addEventListener("submit", function(event) {
        event.preventDefault();
      });
    <\/script>
  </body>
</html>`;
}

export default function FormEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: form, isLoading, error } = useFormData(id);
  const updateMutation = useUpdateForm();
  const deleteMutation = useDeleteForm();

  const [name, setName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<FormStep[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [cssContent, setCssContent] = useState("");
  const [activeTab, setActiveTab] = useState<"fields" | "design" | "settings">("fields");
  const [fieldIdCounter, setFieldIdCounter] = useState(1);

  const previewDocument = useMemo(() => buildPreviewDocument({
    name,
    fields,
    htmlContent,
    cssContent,
    successMessage,
    redirectUrl,
  }), [name, fields, htmlContent, cssContent, successMessage, redirectUrl]);

  useEffect(() => {
    if (form) {
      setName(form.name);
      const normalizedFields = normalizeFields((form.fields as FormField[]) ?? []);
      setFields(normalizedFields);
      setFieldIdCounter(getNextFieldId(normalizedFields));
      setSteps((form.steps as FormStep[]) ?? []);
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
        steps: steps.length > 0 ? steps : undefined,
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
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-on-surface">Live Preview</label>
              <span className="text-xs text-on-surface-variant">Updates as you edit the design and fields.</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-outline-variant bg-white">
              <iframe
                title="Form design preview"
                srcDoc={previewDocument}
                className="h-[560px] w-full"
                sandbox="allow-forms allow-scripts"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
