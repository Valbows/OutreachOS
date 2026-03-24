"use client";

import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const userName = session?.user?.name?.split(" ")[0] || "there";
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {userName} 👋
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Here&apos;s what&apos;s happening across your campaigns today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Contacts"
          value="2,847"
          icon={<ContactsStatIcon />}
        />
        <StatCard
          label="Active Campaigns"
          value="4"
          subtext="2 testing, 2 production"
          icon={<CampaignStatIcon />}
        />
        <StatCard
          label="Avg Open Rate"
          value="38.4%"
          trend="+2.1%"
          icon={<OpenRateIcon />}
        />
        <StatCard
          label="Avg Response Rate"
          value="2.1%"
          trend="+0.3%"
          icon={<ResponseRateIcon />}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Campaigns — 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <CampaignRow
                name="Q4 Enterprise Outreach"
                type="Multi-Channel Seq"
                status="production"
              />
              <CampaignRow
                name="Founder Direct [A/B]"
                type="Direct Email"
                status="testing"
              />
              <CampaignRow
                name="Lead Nurturing Loop"
                type="Automated Flow"
                status="production"
              />
            </div>
          </CardContent>
        </Card>

        {/* Inbox Health — 1 col */}
        <Card>
          <CardHeader>
            <CardTitle>Inbox Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthMetric
              label="Bounce Rate"
              value="0.8%"
              status="Safe Range"
              variant="success"
            />
            <HealthMetric
              label="Complaints"
              value="0.04%"
              status="Very Low"
              variant="success"
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActivityItem
              text="Valery scheduled a new send for Q4 Enterprise"
              meta="14:23 · Sequence Action"
            />
            <ActivityItem
              text="System enriched 284 new leads for Founder Direct"
              meta="12:05 · Data Layer"
            />
          </CardContent>
        </Card>

        {/* Experiment Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Experiment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-on-surface-variant">
                Subject Line Test — Q4 Enterprise
              </span>
              <Badge variant="secondary">Running</Badge>
            </div>
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500"
                style={{ width: "65%" }}
              />
            </div>
            <p className="text-xs text-outline mt-2">
              Batch 3 of 5 · 65% complete
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function StatCard({
  label,
  value,
  subtext,
  trend,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-1">
          {label}
        </p>
        <p className="text-2xl font-semibold text-on-surface">{value}</p>
        {subtext && (
          <p className="text-xs text-outline mt-1">{subtext}</p>
        )}
        {trend && (
          <p className="text-xs text-secondary mt-1">{trend} this week</p>
        )}
      </div>
      <span className="text-on-surface-variant/50 [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </span>
    </Card>
  );
}

function CampaignRow({
  name,
  type,
  status,
}: {
  name: string;
  type: string;
  status: "production" | "testing";
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-on-surface">{name}</p>
        <p className="text-xs text-outline">{type}</p>
      </div>
      <Badge variant={status === "production" ? "default" : "secondary"}>
        {status}
      </Badge>
    </div>
  );
}

const healthMetricVariants = {
  success: "text-secondary",
  warning: "text-tertiary",
  error: "text-error",
  default: "text-on-surface",
} as const;

function HealthMetric({
  label,
  value,
  status,
  variant = "default",
}: {
  label: string;
  value: string;
  status: string;
  variant?: keyof typeof healthMetricVariants;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className={`text-lg font-semibold ${healthMetricVariants[variant]}`}>{value}</p>
      </div>
      <span className="text-xs text-outline">{status}</span>
    </div>
  );
}

function ActivityItem({ text, meta }: { text: string; meta: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary/60 shrink-0" />
      <div>
        <p className="text-sm text-on-surface">{text}</p>
        <p className="text-xs text-outline mt-0.5">{meta}</p>
      </div>
    </div>
  );
}

/* --- Stat icons --- */

function ContactsStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function CampaignStatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function OpenRateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

function ResponseRateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
    </svg>
  );
}
