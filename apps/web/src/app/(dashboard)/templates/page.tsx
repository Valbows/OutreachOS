"use client";

import Link from "next/link";
import { useTemplates, useDeleteTemplate, useCreateTemplate } from "@/lib/hooks/use-templates";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const createMutation = useCreateTemplate();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await createMutation.mutateAsync({ name: newName.trim() });
    setShowCreate(false);
    setNewName("");
    router.push(`/templates/${result.data.id}/edit`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Template
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="text-sm font-medium text-on-surface mb-2">New Template</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Template name..."
              className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !templates?.length ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-on-surface mb-1">No templates yet</h3>
          <p className="text-xs text-on-surface-variant mb-4">Create your first email template to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-primary/50 transition-all"
            >
              <Link href={`/templates/${t.id}/edit`} className="block">
                <div className="font-medium text-on-surface group-hover:text-primary transition-colors">
                  {t.name}
                </div>
                <div className="text-xs text-on-surface-variant mt-1">
                  {t.subject || "No subject"} &middot; v{t.version}
                </div>
                {t.tokens && t.tokens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.tokens.slice(0, 4).map((token) => (
                      <span key={token} className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        {`{${token}}`}
                      </span>
                    ))}
                    {t.tokens.length > 4 && (
                      <span className="text-[10px] text-on-surface-variant">+{t.tokens.length - 4} more</span>
                    )}
                  </div>
                )}
              </Link>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
                <span className="text-[10px] text-on-surface-variant">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => {
                    if (confirm("Delete this template?")) deleteMutation.mutate(t.id);
                  }}
                  className="text-[10px] text-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
