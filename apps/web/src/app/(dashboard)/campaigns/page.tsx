"use client";

import { useState } from "react";
import Link from "next/link";
import { useCampaigns, useDeleteCampaign } from "@/lib/hooks/use-campaigns";
import { Badge } from "@/components/ui";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "error" | "secondary" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  stopped: { label: "Stopped", variant: "error" },
};

const TYPE_LABELS: Record<string, string> = {
  one_time: "One-Time",
  journey: "Journey",
  funnel: "Funnel",
  ab_test: "A/B Test",
  newsletter: "Newsletter",
};

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: campaigns, isLoading } = useCampaigns(statusFilter || undefined);
  const deleteMutation = useDeleteCampaign();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Campaign
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "draft", "active", "paused", "completed"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            {status ? STATUS_LABELS[status]?.label ?? status : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !campaigns?.length ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-on-surface mb-1">No campaigns yet</h3>
          <p className="text-xs text-on-surface-variant mb-4">Create your first campaign to start reaching your contacts.</p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-outline-variant overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Name</th>
                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Type</th>
                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Status</th>
                <th className="px-4 py-3 text-left font-medium text-on-surface-variant">Created</th>
                <th className="px-4 py-3 text-right font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const statusInfo = STATUS_LABELS[c.status] ?? { label: c.status, variant: "secondary" as const };
                return (
                  <tr key={c.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${c.id}/analytics`} className="font-medium text-on-surface hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {TYPE_LABELS[c.type] ?? c.type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {c.status === "draft" && (
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="text-primary text-xs hover:underline font-medium"
                          >
                            Send
                          </Link>
                        )}
                        <Link
                          href={`/campaigns/${c.id}/analytics`}
                          className="text-on-surface-variant text-xs hover:text-primary transition-colors"
                        >
                          Analytics
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-error text-xs hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === c.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
