"use client";

import { Card, CardContent } from "@/components/ui";

export default function AnalyticsPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Analytics</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Campaign performance and outreach insights
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Sent" value="—" />
        <StatCard label="Open Rate" value="—" />
        <StatCard label="Reply Rate" value="—" />
        <StatCard label="Bounce Rate" value="—" />
      </div>

      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto text-on-surface-variant/40" aria-hidden="true">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
            </svg>
            <p className="text-sm text-on-surface-variant">
              Analytics data will appear here once you start sending campaigns.
            </p>
            <p className="text-xs text-on-surface-variant/60">
              View per-campaign analytics from the Campaigns page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-on-surface-variant">{label}</p>
        <p className="text-2xl font-semibold text-on-surface mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
