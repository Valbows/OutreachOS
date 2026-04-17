"use client";

import Link from "next/link";
import { useCampaigns } from "@/lib/hooks/use-campaigns";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-outline-variant/20 text-on-surface-variant",
  active: "bg-secondary/20 text-secondary",
  paused: "bg-tertiary/20 text-tertiary",
  completed: "bg-secondary/20 text-secondary",
  stopped: "bg-error-container/40 text-error",
};

export default function NewslettersPage() {
  const { data: campaigns, isLoading, error } = useCampaigns();

  // Filter to newsletter-type campaigns only
  const newsletters = (campaigns || []).filter((c: { type?: string }) => c.type === "newsletter");

  // Compute stats
  const totalSends = newsletters.filter((n: { status?: string }) => n.status === "completed").length;
  const scheduled = newsletters.filter((n: { status?: string }) => n.status === "active").length;
  const drafts = newsletters.filter((n: { status?: string }) => n.status === "draft").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Newsletters</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Send one-off broadcasts to your subscribers.
          </p>
        </div>
        <Link
          href="/campaigns/new?type=newsletter"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Create Newsletter
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sent" value={totalSends.toString()} accent="primary" />
        <StatCard label="Scheduled" value={scheduled.toString()} accent="secondary" />
        <StatCard label="Drafts" value={drafts.toString()} accent="tertiary" />
        <StatCard label="All Newsletters" value={newsletters.length.toString()} accent="primary" />
      </div>

      {/* List */}
      <div className="rounded-2xl bg-surface-container-low overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">Loading newsletters...</div>
        ) : error ? (
          <div className="p-12 text-center" role="alert">
            <h3 className="text-lg font-semibold text-error">Failed to load newsletters</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Please try again.
            </p>
          </div>
        ) : newsletters.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-semibold text-on-surface">No newsletters yet</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Create your first newsletter to reach your subscribers.
            </p>
            <Link
              href="/campaigns/new?type=newsletter"
              className="inline-flex items-center gap-2 mt-6 rounded-lg bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-semibold text-on-primary-fixed hover:shadow-lg hover:shadow-primary/20 transition-all"
            >
              Create Newsletter
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wider text-on-surface-variant">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {newsletters.map((n: { id: string; name: string; status?: string; createdAt?: string | Date }) => (
                  <tr
                    key={n.id}
                    className="border-t border-outline-variant/10 hover:bg-surface-container/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link href={`/campaigns/${n.id}`} className="font-semibold text-on-surface hover:text-primary transition-colors">
                        {n.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                          STATUS_STYLES[n.status || "draft"] || STATUS_STYLES.draft
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {n.status || "draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                      {n.createdAt
                        ? new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/campaigns/${n.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "secondary" | "tertiary";
}) {
  const accentClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    tertiary: "text-tertiary",
  }[accent];

  return (
    <div className="rounded-xl bg-surface-container-low p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-current opacity-[0.03] pointer-events-none" />
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}
