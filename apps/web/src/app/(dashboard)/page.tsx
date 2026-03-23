import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Contacts" value="—" />
        <StatCard label="Active Campaigns" value="—" />
        <StatCard label="Open Rate" value="—" />
        <StatCard label="Response Rate" value="—" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-on-surface-variant text-sm">
            Dashboard content will be populated in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
    </Card>
  );
}
