"use client";

import Link from "next/link";
import { useForms, useDeleteForm } from "@/lib/hooks/use-forms";
import { useRouter } from "next/navigation";

export default function FormsDashboardPage() {
  const { data: forms, isLoading, error } = useForms();
  const deleteMutation = useDeleteForm();
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Forms</h1>
        <button
          onClick={() => router.push("/forms/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Form
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error/30 bg-error/5 p-6 text-center">
          <p className="text-sm text-error">Failed to load forms. Please try again.</p>
        </div>
      ) : !forms?.length ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" className="text-primary" />
              <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-on-surface mb-1">No forms yet</h3>
          <p className="text-xs text-on-surface-variant mb-4">Create embeddable forms to capture leads and grow your contact list.</p>
          <button
            onClick={() => router.push("/forms/new")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Create Your First Form
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="group rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-primary/50 transition-all"
            >
              <Link href={`/forms/${form.id}/edit`} className="block">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-medium text-on-surface group-hover:text-primary transition-colors">
                    {form.name}
                  </div>
                  <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] text-on-surface-variant capitalize">
                    {form.type.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant">
                  {form.fields?.length ?? 0} fields &middot; {form.submissionCount ?? 0} submissions
                </div>
              </Link>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant">
                <Link
                  href={`/forms/${form.id}/embed`}
                  className="text-[10px] text-primary hover:underline"
                >
                  Get embed code
                </Link>
                <button
                  onClick={() => {
                    if (deleteMutation.isPending) return;
                    if (confirm("Delete this form?")) {
                      deleteMutation.mutate(form.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-[10px] text-error hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete form ${form.name}`}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteMutation.isError && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-xs text-error">
          Delete failed: {deleteMutation.error?.message ?? "An error occurred"}
        </div>
      )}
    </div>
  );
}
