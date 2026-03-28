"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateForm } from "@/lib/hooks/use-forms";
import Link from "next/link";

const FORM_TYPES = [
  { type: "minimal", label: "Minimal", description: "Clean, single-column form. Best for simple lead capture." },
  { type: "modal", label: "Modal Popup", description: "Overlay popup that grabs attention. Great for exit-intent." },
  { type: "inline_banner", label: "Inline Banner", description: "Horizontal banner that embeds in page flow." },
  { type: "multi_step", label: "Multi-Step Wizard", description: "Step-by-step flow for longer forms." },
  { type: "side_drawer", label: "Side Drawer", description: "Slides in from the right. Non-intrusive." },
] as const;

export default function ChooseFormTemplatePage() {
  const router = useRouter();
  const createMutation = useCreateForm();
  const [selected, setSelected] = useState<string | null>(null);
  const [formName, setFormName] = useState("");

  async function handleCreate() {
    if (!selected || !formName.trim()) return;
    try {
      const result = await createMutation.mutateAsync({
        name: formName.trim(),
        type: selected,
        fields: [
          { name: "email", type: "email", required: true, label: "Email Address" },
          { name: "firstName", type: "text", required: false, label: "First Name" },
        ],
      });
      router.push(`/forms/${result.data.id}/edit`);
    } catch {
      // Error is handled by createMutation.error state (displayed in UI)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
        <Link href="/forms" className="hover:text-primary transition-colors">Forms</Link>
        <span>/</span>
        <span>New Form</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-on-surface mb-6">Choose a Template</h1>

      {/* Form name input */}
      <div className="mb-6">
        <label htmlFor="form-name" className="block text-sm font-medium text-on-surface mb-1">
          Form Name
        </label>
        <input
          id="form-name"
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g., Newsletter Signup"
          className="w-full max-w-md rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Template grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {FORM_TYPES.map((ft) => (
          <button
            key={ft.type}
            onClick={() => setSelected(ft.type)}
            className={`rounded-xl border p-5 text-left transition-all ${
              selected === ft.type
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-outline-variant bg-surface-container-low hover:border-primary/50"
            }`}
          >
            <div className="font-medium text-on-surface mb-1">{ft.label}</div>
            <p className="text-xs text-on-surface-variant leading-relaxed">{ft.description}</p>
          </button>
        ))}
      </div>

      {/* Create button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={!selected || !formName.trim() || createMutation.isPending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Create Form"}
        </button>
        <Link
          href="/forms"
          className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
        >
          Cancel
        </Link>
      </div>
      {createMutation.isError && (
        <p className="mt-3 text-xs text-error">
          {((): string => {
            const err = createMutation.error as unknown;
            if (typeof err === "string") return err;
            if (err && typeof err === "object" && "message" in err) {
              return String((err as { message: unknown }).message);
            }
            return "An error occurred";
          })()}
        </p>
      )}
    </div>
  );
}
